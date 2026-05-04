const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Leads.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacement = `                                    </div>
                                </div>
                            )}

                            {/* Server Pagination */}
                            {hasNextPage && (
                                <div className="p-4 border-t border-gray-100 bg-white flex justify-center">
                                    <button
                                        onClick={() => fetchNextPage()}
                                        disabled={isFetchingNextPage}
                                        className="px-6 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-sm hover:bg-gray-100 disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {isFetchingNextPage ? 'Cargando más...' : 'Cargar más Leads del Servidor'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>`;

// Use regex to find the end of the Pagination Controls
const regex = /<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;

if (content.includes(`                                    </div>
                                </div>
                            )}
                        </div>
                    </div>`)) {
    content = content.replace(`                                    </div>
                                </div>
                            )}
                        </div>
                    </div>`, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Replaced exact match');
} else {
    console.log('Failed to find exact match');
}
