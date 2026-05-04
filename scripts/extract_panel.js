import fs from 'fs';

const content = fs.readFileSync('src/pages/Leads.tsx', 'utf8');
const lines = content.split('\n');

const startIdx = 2394;
const endIdx = 3181;

const panelLines = lines.slice(startIdx, endIdx + 1);

const imports = `import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Calendar, CheckCircle, Plus, FileText, Send, Clock, Trash2, Shield, X, MapPin, Building, Globe, Copy, RefreshCw, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../services/supabase';
import { leadsService } from '../../services/leads';
import { callActivityService } from '../../services/callActivity';
import { logger } from '../../utils/logger';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG } from '../../types';
import type { Lead, FollowUp, CallActivity } from '../../types';
import { FollowUpLogger } from '../FollowUpLogger';
import { QuickActionLogger } from '../QuickCallLogger';
import { DocumentGenerator } from '../DocumentGenerator';
import { WhatsAppDialog } from '../WhatsAppDialog';
import { EmailDialog } from '../EmailDialog';
import toast from 'react-hot-toast';

interface LeadDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    onUpdateLead: (updates: Partial<Lead>) => Promise<void>;
    teamMembers: any[];
    profile: any;
    isAdmin: boolean;
    navigate: any;
    storageService: any;
}

export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({
    isOpen,
    onClose,
    lead,
    onUpdateLead,
    teamMembers,
    profile,
    isAdmin,
    navigate,
    storageService
}) => {
    const [followUps, setFollowUps] = useState<FollowUp[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [callActivities, setCallActivities] = useState<CallActivity[]>([]);
    const [activeTab, setActiveTab] = useState<'activity' | 'info' | 'quotes'>('activity');
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    
    // Dialog states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
    const [isDocGeneratorOpen, setIsDocGeneratorOpen] = useState(false);
    const [isFollowUpLoggerOpen, setIsFollowUpLoggerOpen] = useState(false);

    useEffect(() => {
        if (isOpen && lead) {
            loadDetails();
        }
    }, [isOpen, lead?.id]);

    const loadDetails = async () => {
        if (!lead) return;
        setIsLoadingDetails(true);
        try {
            const [followUpsData, messagesData, activitiesData] = await Promise.all([
                leadsService.getFollowUps(lead.id),
                leadsService.getLeadMessages(lead.id),
                callActivityService.getLeadCalls(lead.id),
            ]);
            setFollowUps(followUpsData || []);
            setMessages(messagesData || []);
            setCallActivities(activitiesData || []);
        } catch (error) {
            logger.error('Failed to load details', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    if (!isOpen || !lead) return null;

    const selectedLead = lead;
    const setIsDetailOpen = (val: boolean) => { if (!val) onClose(); };

`;

panelLines[0] = panelLines[0].replace('{isDetailOpen && selectedLead && (', 'return (');
panelLines[panelLines.length - 1] = panelLines[panelLines.length - 1].replace(')}', ');');

const componentEnd = '\n};\n';

fs.writeFileSync('src/components/leads/LeadDetailPanel.tsx', imports + panelLines.join('\n') + componentEnd);
console.log('Successfully created LeadDetailPanel.tsx');

const newLeadsLines = [
    ...lines.slice(0, startIdx),
    '            <LeadDetailPanel',
    '                isOpen={isDetailOpen}',
    '                onClose={() => setIsDetailOpen(false)}',
    '                lead={selectedLead!}',
    '                onUpdateLead={handleUpdateLead}',
    '                teamMembers={teamMembers}',
    '                profile={profile}',
    '                isAdmin={isAdmin}',
    '                navigate={navigate}',
    '                storageService={storageService}',
    '            />',
    ...lines.slice(endIdx + 1)
];

fs.writeFileSync('src/pages/Leads.tsx', newLeadsLines.join('\n'));
console.log('Successfully updated Leads.tsx');
