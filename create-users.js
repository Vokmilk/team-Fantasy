// create-users.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ВАЖНО: Для создания юзеров без подтверждения почты нужен SERVICE_ROLE_KEY
// Возьмите его в Supabase: Project Settings -> API -> service_role key (secret)
// Если его нет в .env, вставьте его сюда строкой, но не пушьте в гит
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Ошибка: Не найден URL или SERVICE_ROLE_KEY. Проверьте .env.local');
  console.log('Вам нужно добавить в .env.local строку: SUPABASE_SERVICE_ROLE_KEY=ваш_ключ_из_настроек');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTestUsers() {
  for (let i = 1; i <= 5; i++) {
    const email = `test${i}@test.com`;
    const password = `test${i}test${i}`; // Пароль будет test1test1, test2test2...

    console.log(`Создаю пользователя: ${email}...`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Сразу подтверждаем почту, чтобы можно было войти
    });

    if (error) {
      console.error(`Ошибка при создании ${email}:`, error.message);
    } else {
      console.log(`Успешно: ${data.user.email} (ID: ${data.user.id})`);
    }
  }
}

createTestUsers();