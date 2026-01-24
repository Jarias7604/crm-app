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
    } | null;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    status: string;
    sent_at: string;
}

export const chatService = {
    async getConversations() {
        const { data, error } = await supabase
            .from('marketing_conversations')
            .select(`
                *,
                lead:leads(id, name, email, company_name)
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

    async sendMessage(conversationId: string, content: string) {
        const { data, error } = await supabase
            .from('marketing_messages')
            .insert({
                conversation_id: conversationId,
                content,
                direction: 'outbound',
                status: 'sent'
            })
            .select()
            .single();

        if (error) throw error;

        // Update last message in conversation
        await supabase
            .from('marketing_conversations')
            .update({
                last_message: content,
                last_message_at: new Date().toISOString()
            })
            .eq('id', conversationId);

        return data as ChatMessage;
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
