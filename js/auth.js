'use strict';

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function requireAuthenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.replace('login.html');
    return null;
  }

  return user;
}

async function requireAdmin() {
  const profile = await getCurrentProfile();

  if (!profile) {
    window.location.replace('login.html');
    return null;
  }

  if (profile.role !== 'admin') {
    window.location.replace('index.html');
    return null;
  }

  return profile;
}

async function redirectLoggedInUserFromLogin() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return;
  }

  if (profile.role === 'admin') {
    window.location.replace('admin.html');
    return;
  }

  window.location.replace('index.html');
}

async function signOutCurrentUser() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }

  window.location.replace('login.html');
}

function getLoginErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();

  if (
    message.includes('invalid login credentials')
    || message.includes('invalid credentials')
  ) {
    return 'تعذر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.';
  }

  if (message.includes('email not confirmed')) {
    return 'يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.';
  }

  if (message.includes('too many requests')) {
    return 'تمت محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.';
  }

  if (message.includes('network')) {
    return 'تعذر الاتصال بالإنترنت. تأكد من الشبكة ثم حاول مرة أخرى.';
  }

  return 'حدثت مشكلة أثناء تسجيل الدخول. حاول مرة أخرى.';
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const emailInput = form.querySelector('#email');
  const passwordInput = form.querySelector('#password');
  const messageElement = document.querySelector('#login-message');
  const loginButton = document.querySelector('#login-button');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setMessage(messageElement);

  if (!email || !password) {
    setMessage(
      messageElement,
      'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
      'error'
    );
    return;
  }

  setButtonLoading(loginButton, true, 'جارٍ تسجيل الدخول...');

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const profile = await getCurrentProfile();

    if (!profile) {
      await supabaseClient.auth.signOut();

      setMessage(
        messageElement,
        'تم تسجيل الدخول، لكن لم يتم العثور على صلاحيات لهذا الحساب. تواصل مع الإدارة.',
        'error'
      );

      return;
    }

    if (profile.role === 'admin') {
      window.location.replace('admin.html');
      return;
    }

    window.location.replace('index.html');
  } catch (error) {
    setMessage(messageElement, getLoginErrorMessage(error), 'error');
  } finally {
    setButtonLoading(loginButton, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('#login-form');

  if (loginForm) {
    redirectLoggedInUserFromLogin();
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
});