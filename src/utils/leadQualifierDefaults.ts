import {
    DEFAULT_BUSINESS_HOURS,
    DEFAULT_FIRST_TOUCH_TEMPLATE,
    DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
    DEFAULT_HANDOFF_BUSINESS_REPLY,
    DEFAULT_HANDOFF_KEYWORDS,
    DEFAULT_PAIN_PLAYBOOKS,
    DEFAULT_QUALIFIER_SYSTEM_PROMPT,
    DEFAULT_TZ,
    renderFirstTouchMessage,
    type BusinessHoursConfig,
    type DemoSlot,
    type PainPlaybook,
    type RoutingRuleLike,
} from '../../supabase/functions/lead-qualifier-engine/helpers';

export type { PainPlaybook, BusinessHoursConfig, DemoSlot, RoutingRuleLike };

export {
    DEFAULT_BUSINESS_HOURS,
    DEFAULT_FIRST_TOUCH_TEMPLATE,
    DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
    DEFAULT_HANDOFF_BUSINESS_REPLY,
    DEFAULT_HANDOFF_KEYWORDS,
    DEFAULT_PAIN_PLAYBOOKS,
    DEFAULT_QUALIFIER_SYSTEM_PROMPT,
    DEFAULT_TZ,
    renderFirstTouchMessage,
};

export interface LeadQualifierConfig {
    id?: string;
    company_id: string;
    is_enabled: boolean;
    mode: 'draft' | 'auto';
    response_24_7: boolean;
    allowed_sources: string[];
    max_ai_turns: number;
    timezone: string;
    business_hours: BusinessHoursConfig;
    system_prompt: string;
    first_touch_template: string;
    handoff_reply_business_hours: string;
    handoff_reply_after_hours: string;
    handoff_keywords: string[];
    pain_playbooks: PainPlaybook[];
    demo_duration_minutes: number;
    demo_buffer_minutes: number;
    notify_on_urgent_intake: boolean;
    notify_on_handoff: boolean;
    notify_on_demo_booked: boolean;
    notify_advisors_24_7: boolean;
    notify_channels: { whatsapp: boolean; crm_alert: boolean; email: boolean };
    sla_escalation_minutes: number;
    sla_backup_user_id: string | null;
    crm_base_url: string;
}

export interface LeadQualifierSession {
    id: string;
    company_id: string;
    lead_id: string;
    ticket_id: string | null;
    status:
        | 'draft_pending'
        | 'active'
        | 'paused'
        | 'handed_off'
        | 'demo_booked'
        | 'human_takeover'
        | 'closed'
        | 'max_turns';
    mode: 'draft' | 'auto';
    turn_count: number;
    matched_playbook_id: string | null;
    first_message_draft: string | null;
    last_ai_draft: string | null;
    last_ai_action: string | null;
    offered_slots: DemoSlot[];
    booked_start_time: string | null;
    booked_end_time: string | null;
    booked_meet_link: string | null;
    assigned_advisor_id: string | null;
    handoff_reason: string | null;
    handoff_summary: string | null;
    handoff_at: string | null;
    sla_deadline_at: string | null;
    sla_escalated_at: string | null;
    advisor_notified_at: string | null;
    created_at: string;
    updated_at: string;
    leads?: {
        id: string;
        name: string;
        company_name?: string | null;
        phone?: string | null;
        status?: string | null;
    } | null;
}

export function buildDefaultQualifierConfig(companyId: string): LeadQualifierConfig {
    return {
        company_id: companyId,
        is_enabled: false,
        mode: 'draft',
        response_24_7: true,
        allowed_sources: ['facebook_ads', 'google_sheets'],
        max_ai_turns: 6,
        timezone: DEFAULT_TZ,
        business_hours: { ...DEFAULT_BUSINESS_HOURS },
        system_prompt: DEFAULT_QUALIFIER_SYSTEM_PROMPT,
        first_touch_template: DEFAULT_FIRST_TOUCH_TEMPLATE,
        handoff_reply_business_hours: DEFAULT_HANDOFF_BUSINESS_REPLY,
        handoff_reply_after_hours: DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
        handoff_keywords: [...DEFAULT_HANDOFF_KEYWORDS],
        pain_playbooks: DEFAULT_PAIN_PLAYBOOKS.map((p) => ({ ...p })),
        demo_duration_minutes: 30,
        demo_buffer_minutes: 15,
        notify_on_urgent_intake: false,
        notify_on_handoff: true,
        notify_on_demo_booked: true,
        notify_advisors_24_7: true,
        notify_channels: { whatsapp: true, crm_alert: true, email: false },
        sla_escalation_minutes: 15,
        sla_backup_user_id: null,
        crm_base_url: 'https://ariascrm.com',
    };
}
