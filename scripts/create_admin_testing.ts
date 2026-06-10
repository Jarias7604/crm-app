import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ubqscyfefgfbmndnypbp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhc2UiLCJyZWYiOiJ1YnFzY3lmZWZnZmJtbmRueXBicCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NzczOTcwNjksImV4cCI6MjA5Mjk3MzA2OX0.7ZMxJBdn5g2dxQxfbsHULoFhJPbnKWF-vw-bagX825E';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('🚀 Setting up master user in testing environment...');

  // 1. Create company if not exists
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id')
    .limit(1);

  if (compErr) {
    console.error('Error fetching company:', compErr);
    return;
  }

  let companyId = companies?.[0]?.id;
  if (!companyId) {
    const { data: newComp, error: newCompErr } = await supabase
      .from('companies')
      .insert({ name: 'Arias Defense Components Testing' })
      .select('id')
      .single();
    
    if (newCompErr) {
      console.error('Error creating company:', newCompErr);
      return;
    }
    companyId = newComp.id;
    console.log('Created company:', companyId);
  } else {
    console.log('Using company:', companyId);
  }

  // 2. Create user via Auth Admin API
  const email = 'jarias7604@gmail.com';
  const password = 'Arias2026!';

  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr);
    return;
  }

  let user = userList.users.find(u => u.email === email);
  if (!user) {
    console.log('Creating new user...');
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Jaime Arias' }
    });

    if (createErr) {
      console.error('Error creating user:', createErr);
      return;
    }
    user = newUser.user;
    console.log('Created user:', user.id);
  } else {
    console.log('User already exists, updating password and confirming email...');
    const { data: updatedUser, error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true
    });

    if (updateErr) {
      console.error('Error updating user:', updateErr);
      return;
    }
    user = updatedUser.user;
    console.log('Updated user:', user.id);
  }

  // 3. Ensure profile / team member exists
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr) {
    console.error('Error fetching profile:', profErr);
  }

  if (!profile) {
    console.log('Creating profile...');
    const { error: insErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: 'Jaime Arias',
        email: email,
        role: 'company_admin',
        company_id: companyId
      });

    if (insErr) {
      console.error('Error inserting profile:', insErr);
    } else {
      console.log('Profile created successfully.');
    }
  } else {
    // Update role
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ email: email, role: 'company_admin', company_id: companyId })
      .eq('id', user.id);

    if (updErr) {
      console.error('Error updating profile role:', updErr);
    } else {
      console.log('Profile updated to administrator.');
    }
  }

  console.log('✅ Done! User is ready to log in locally with password.');
}

run();
