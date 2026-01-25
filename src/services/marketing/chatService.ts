import { supabase } from '../supabase';

export interface ChatConversation {
    id: string;
    channel: 'whatsapp' | 'telegram' | 'web';
    status: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    lead: {
        id: string;
        name: string;
        email: string | null;
        company_name: string | null;
        phone: string | null;
    } | null;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    type: 'text' | 'image' | 'file';
    status: string;
    metadata: any;
    sent_at: string;
}

export const chatService = {
    async createConversation(leadId: string, channel: string, externalId: string = 'internal') {
        const { data: profile } = await supabase.from('profiles').select('company_id').single();
        if (!profile?.company_id) throw new Error('No company found');

        const { data, error } = await supabase
            .from('marketing_conversations')
            .insert({
                company_id: profile.company_id,
                lead_id: leadId,
                channel,
                external_id: externalId,
                last_message: 'Nueva conversación...',
                unread_count: 0
            })
            .select()
            .single();

        if (error) throw error;
        return data as ChatConversation;
    },

    async getConversations() {
        const { data, error } = await supabase
            .from('marketing_conversations')
            .select(`
                *,
                lead:leads(id, name, email, company_name, phone)
            `)
            .order('last_message_at', { ascending: false });

        if (error) throw error;
        return data as ChatConversation[];
    },

    async getMessages(conversationId: string) {
        const { data, error } = await supabase
            .from('marketing_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('sent_at', { ascending: true });

        if (error) throw error;
        return data as ChatMessage[];
    },

    async sendMessage(conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', direction: 'inbound' | 'outbound' = 'outbound', metadata: any = {}) {
        // 1. Insert into local database
        const { data: msg, error } = await supabase
            .from('marketing_messages')
            .insert({
                conversation_id: conversationId,
                content,
                type,
                metadata: { ...metadata, origin: typeof window !== 'undefined' ? window.location.origin : 'server' },
                direction,
                status: direction === 'outbound' ? 'pending' : 'delivered'
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Update conversation preview
        await supabase
            .from('marketing_conversations')
            .update({
                last_message: content,
                last_message_at: new Date().toISOString()
            })
            .eq('id', conversationId);

        // 3. TRIGGER SENDING (Only for Outbound)
        if (direction === 'outbound') {
            supabase.functions.invoke('send-telegram-message', {
                body: { record: msg }
            }).then(({ data, error }) => {
                if (error) console.error('Edge Function Error:', error);
            });
        }

        return msg as ChatMessage;
    },

    async markAsRead(conversationId: string) {
        const { error } = await supabase
            .from('marketing_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);

        if (error) throw error;
    },

    // Real-time subscription helper
    subscribeToMessages(conversationId: string, onMessage: (msg: ChatMessage) => void) {
        return supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'marketing_messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    onMessage(payload.new as ChatMessage);
                }
            )
            .subscribe();
    },

    subscribeToConversations(onUpdate: () => void) {
        return supabase
            .channel('conversations_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'marketing_conversations' },
                () => onUpdate()
            )
            .subscribe();
    }
};
