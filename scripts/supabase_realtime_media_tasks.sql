-- Enable realtime for media_tasks table
alter publication supabase_realtime add table media_tasks;

-- Enable RLS and restrict access to own rows
alter table media_tasks enable row level security;

create policy "Users can only listen to their own tasks"
on media_tasks
for select
using (auth.uid()::text = user_id);
