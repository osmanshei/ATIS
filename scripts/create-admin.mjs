import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "ATIS_ADMIN_EMAIL",
  "ATIS_ADMIN_USERNAME",
  "ATIS_ADMIN_PASSWORD",
  "ATIS_ADMIN_FULL_NAME",
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: school, error: schoolError } = await supabase
  .from("schools")
  .select("id")
  .eq("code", "ATIS")
  .single();
if (schoolError || !school) throw schoolError || new Error("ATIS school seed not found.");

const email = process.env.ATIS_ADMIN_EMAIL.trim().toLowerCase();
const username = process.env.ATIS_ADMIN_USERNAME.trim();
const password = process.env.ATIS_ADMIN_PASSWORD;
const fullName = process.env.ATIS_ADMIN_FULL_NAME.trim();

let userId;
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username, full_name: fullName },
});

if (createError) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!existing) throw createError;
  userId = existing.id;
  console.log("Auth user already exists; linking existing user.");
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabase.from("profiles").upsert({
  user_id: userId,
  school_id: school.id,
  username,
  full_name: fullName,
  email,
  role: "admin",
  status: "active",
  must_change_password: false,
}, { onConflict: "user_id" });
if (profileError) throw profileError;

const { data: existingStaff } = await supabase
  .from("staff")
  .select("id")
  .eq("user_id", userId)
  .maybeSingle();

if (!existingStaff) {
  const { error: staffError } = await supabase.from("staff").insert({
    school_id: school.id,
    user_id: userId,
    employee_code: "ATIS-ADMIN-001",
    full_name: fullName,
    email,
    role: "admin",
    position_title: "Administrator",
    status: "active",
  });
  if (staffError) throw staffError;
}

console.log(`ATIS administrator ready: ${username} (${email})`);
