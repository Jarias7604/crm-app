const fs = require('fs');
let content = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

// 1. Add imports
content = content.replace("import { useQuery, useQueryClient } from '@tanstack/react-query';", "import { useQuery, useQueryClient } from '@tanstack/react-query';\nimport { LeadTable } from '../components/leads/LeadTable';\nimport { LeadDetailPanel } from '../components/leads/LeadDetailPanel';");

// 2. Fix onUpdateLead
content = content.replace("onUpdateLead={handleUpdateLead}", "handleUpdateLead={handleUpdateLead}");

// 3. Fix cotizaciones?.length
content = content.replace(/\{\(lead\.cotizaciones\?\.length > 0 \|\| lead\.document_path\) && \(/g, "{((lead.cotizaciones?.length ?? 0) > 0 || lead.document_path) && (");

// 4. Fix LeadDetailPanel props
content = content.replace(/storageService=\{storageService\}\s+StatusBadge=\{StatusBadge\} PriorityBadge=\{PriorityBadge\} \/>/g, `storageService={storageService}
                industries={industries}
                handleFileDownload={handleFileDownload}
                handleFileDelete={handleFileDelete}
                handleFileUpload={handleFileUpload}
                isUploading={isUploading}
                isCallLoggerOpen={isCallLoggerOpen}
                setIsCallLoggerOpen={setIsCallLoggerOpen}
                callStartedAt={callStartedAt}
                setCallStartedAt={setCallStartedAt}
                handleDeleteLead={handleDeleteLead}
                StatusBadge={StatusBadge}
                PriorityBadge={PriorityBadge}
            />`);

fs.writeFileSync('src/pages/Leads.tsx', content);
console.log('Fixed Leads.tsx imports and props!');
