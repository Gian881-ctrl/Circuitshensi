'use strict';
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu(returnFocus = false) {
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (returnFocus) menu.focus();
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const form = document.querySelector('#repair-form');

const fields = [
  { element: form.elements.customerName, error: 'name-error', label: 'Customer name', message: 'Enter your name.' },
  { element: form.elements.mobile, error: 'mobile-error', label: 'Mobile number', message: 'Enter your mobile number.' },
  { element: form.elements.device, error: 'device-error', label: 'Device or project', message: 'Enter a device model or PCB project.' },
  { element: form.elements.issue, error: 'issue-error', label: 'Issue description', message: 'Describe the issue or the project you have in mind.' }
];
function validate(field) {
  const value = field.element.value.trim();
  let message = value ? '' : field.message;
  if (value && field.element.name === 'mobile') {
    const digits = value.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) {
      message = 'Enter a valid phone number with 7–15 digits. Spaces, +, parentheses, and hyphens are OK.';
    }
  }
  document.getElementById(field.error).textContent = message;
  field.element.setAttribute('aria-invalid', String(Boolean(message)));
  return !message;
}
form.addEventListener('submit', event => {
  const invalid = fields.filter(field => !validate(field));
  if (invalid.length) {
    event.preventDefault();
    invalid[0].element.focus();
    return;
  }
  if (!form.elements.preference.value) {
    event.preventDefault();
    form.querySelector('input[name="preference"]').focus();
    return;
  }
  // Valid requests use the form's native POST to Formspree.
  fields.forEach(field => { field.element.value = field.element.value.trim(); });
});
form.addEventListener('input', event => {
  const field = fields.find(item => item.element === event.target);
  if (field && field.element.getAttribute('aria-invalid') === 'true') validate(field);
});
function syncPaymentInfo() {
  const preference = form.elements.preference.value;
  document.querySelector('#payment-mail-in').hidden = preference !== 'mail-in';
  document.querySelector('#payment-local').hidden = preference !== 'local';
}
form.querySelectorAll('input[name="preference"]').forEach(input => {
  input.addEventListener('input', syncPaymentInfo);
});
document.querySelectorAll('[data-preference]').forEach(link => link.addEventListener('click', () => {
  form.elements.preference.value = link.dataset.preference;
  syncPaymentInfo();
}));
window.addEventListener('pageshow', syncPaymentInfo);
form.addEventListener('reset', () => setTimeout(syncPaymentInfo, 0));
syncPaymentInfo();

const chatToggle = document.querySelector('#chat-toggle');
const chatPanel = document.querySelector('#chat-panel');
function closeChat(returnFocus = false) {
  chatPanel.hidden = true;
  chatToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) chatToggle.focus();
}
chatToggle.addEventListener('click', () => {
  const opening = chatPanel.hidden;
  chatPanel.hidden = !opening;
  chatToggle.setAttribute('aria-expanded', String(opening));
  if (opening) document.querySelector('#close-chat').focus();
});
document.querySelector('#close-chat').addEventListener('click', () => closeChat(true));
document.querySelector('#chat-inquiry').addEventListener('click', () => { closeChat(); fields[0].element.focus(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!chatPanel.hidden) closeChat(true);
  else if (menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!chatPanel.hidden && !chatPanel.contains(event.target) && !chatToggle.contains(event.target)) closeChat();
});

// Only replace native validation after all enhancement handlers are ready.
form.noValidate = true;
