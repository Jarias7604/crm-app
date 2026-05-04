const fs = require('fs');

// 1. Fix Leads.tsx
let lines = fs.readFileSync('src/pages/Leads.tsx', 'utf8').split('\n');

if (!lines.find(l => l.includes('import { LeadTable }'))) {
    lines.splice(2, 0, "import { LeadTable } from '../components/leads/LeadTable';");
    lines.splice(3, 0, "import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';");
}

lines = lines.filter(l => 
    !l.includes('const [followUps, setFollowUps] = useState') &&
    !l.includes('const [messages, setMessages] = useState') &&
    !l.includes('const [callActivities, setCallActivities] = useState')
);

let c = lines.join('\n');
c = c.replace(/const loadFollowUps = async [\s\S]+?catch \(error\) \{[\s\S]+?\}\s+\};\n/g, '');
c = c.replace(/loadFollowUps\([^)]+\);\n?/g, '');

// Fix LeadDetailPanel props in Leads.tsx
c = c.replace(/<LeadDetailPanel([\s\S]+?)storageService=\{storageService\}\s*\/>/g, 
`<LeadDetailPanel$1storageService={storageService}
                industries={industries}
                handleFileDownload={handleFileDownload}
                handleFileDelete={handleFileDelete}
                handleFileUpload={handleFileUpload}
                isUploading={isUploading}
                isCallLoggerOpen={isCallLoggerOpen}
                setIsCallLoggerOpen={setIsCallLoggerOpen}
                callStartedAt={callStartedAt}
                setCallStartedAt={setCallStartedAt}
            />`);

fs.writeFileSync('src/pages/Leads.tsx', c);

// 2. Fix LeadDetailPanel.tsx Props
let panel = fs.readFileSync('src/components/leads/LeadDetailPanel.tsx', 'utf8');

panel = panel.replace(/interface LeadDetailPanelProps \{([\s\S]+?)\}/, 
`interface LeadDetailPanelProps {$1
    industries: any[];
    handleFileDownload: (e: any) => Promise<void>;
    handleFileDelete: (e: any) => Promise<void>;
    handleFileUpload: (e: any) => Promise<void>;
    isUploading: boolean;
    isCallLoggerOpen: boolean;
    setIsCallLoggerOpen: (val: boolean) => void;
    callStartedAt: number | null;
    setCallStartedAt: (val: number | null) => void;
}`);

panel = panel.replace(/export const LeadDetailPanel: React\.FC<LeadDetailPanelProps> = \(\{([^}]+)\}\) => \{/,
`export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({$1, industries, handleFileDownload, handleFileDelete, handleFileUpload, isUploading, isCallLoggerOpen, setIsCallLoggerOpen, callStartedAt, setCallStartedAt}) => {`);

fs.writeFileSync('src/components/leads/LeadDetailPanel.tsx', panel);
console.log('Fixed Leads and LeadDetailPanel');
