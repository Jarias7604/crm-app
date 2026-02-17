-- Add value column to leads table for CRM Pipeline
alter table public.leads 
add column if not exists value numeric default 0;

-- Optional: Update existing leads with random values for demo purposes
-- update public.leads set value = floor(random() * 10000 + 1000);
