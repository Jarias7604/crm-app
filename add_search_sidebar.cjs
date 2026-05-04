const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Sidebar.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `<nav className="flex-1 space-y-1.5 focus:outline-none">
                    {navigation.map((item) => (`;

const replacement = `<nav className="flex-1 space-y-1.5 focus:outline-none">
                    {/* OMNI SEARCH BUTTON */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                        className={cn(
                            'group flex items-center justify-between rounded-xl transition-all duration-200 focus:outline-none mb-4 w-full bg-[#1e293b]/50 border border-gray-800 hover:bg-[#1e293b] hover:border-gray-700',
                            isCollapsed ? "p-3" : "px-4 py-2.5"
                        )}
                        title="Omni-Buscador (Cmd+K)"
                    >
                        <div className="flex items-center text-gray-400 group-hover:text-white transition-colors">
                            <Search className={cn("h-5 w-5 shrink-0 transition-colors", !isCollapsed && "mr-3")} />
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide">Omni-Buscador</span>}
                        </div>
                        {!isCollapsed && (
                            <div className="flex items-center gap-1">
                                <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-gray-500 group-hover:text-gray-400">⌘</kbd>
                                <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-gray-500 group-hover:text-gray-400">K</kbd>
                            </div>
                        )}
                    </button>

                    {navigation.map((item) => (`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    content = normalizedContent.replace(normalizedTarget, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Sidebar updated');
} else {
    console.error('Sidebar not updated');
}
