const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Leads.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `    const { data: leadsData, isLoading: loading } = useQuery({
        queryKey: ['leads'],
        queryFn: async () => {
            const { data } = await leadsService.getLeads();
            return data || [];
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const leads = leadsData ?? [];`;

const replacement = `    const { 
        data: leadsData, 
        isLoading: loading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['leads'],
        queryFn: async ({ pageParam }) => {
            const result = await leadsService.getLeadsCursor(50, pageParam);
            return result;
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const leads = leadsData?.pages.flatMap(page => page.data) ?? [];`;

// normalize line endings to try and match
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
    const newContent = normalizedContent.replace(normalizedTarget, replacement);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully replaced React Query block.');
} else {
    console.log('Target block not found. Trying regex...');
    
    const regex = /const \{ data: leadsData, isLoading: loading \} = useQuery\(\{[\s\S]*?\}\);\s*const leads = leadsData \?\? \[\];/;
    if (regex.test(normalizedContent)) {
        const newContent = normalizedContent.replace(regex, replacement);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Successfully replaced React Query block via Regex.');
    } else {
        console.error('Failed to find block with regex too.');
    }
}
