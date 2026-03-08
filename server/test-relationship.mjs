// Full auth'd test of all critical endpoints
const BASE = 'http://localhost:4000/api';

// Login
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mebaburao888@gmail.com', password: 'Admin1234!' })
});
const cookie = loginRes.headers.get('set-cookie') ?? '';
console.log('1. Login:', loginRes.status);

const FAMILY = 'bffba656-8943-48ed-b89d-4f76a4f09b5a';
const PERSON1 = '1b779380-6c62-49b0-8554-8829b7ac012a'; // Hatim Ali
const PERSON2 = '704281a3-5bcc-442d-add1-dfe5aba9b460'; // Zainab

const headers = { 'Content-Type': 'application/json', Cookie: cookie };

// Test all critical endpoints
const tests = [
  ['GET', `${BASE}/families/mine`, null],
  ['GET', `${BASE}/families/${FAMILY}`, null],
  ['GET', `${BASE}/families/${FAMILY}/tree`, null],
  ['GET', `${BASE}/families/${FAMILY}/proposals`, null],
  ['POST', `${BASE}/relationships`, { family_id: FAMILY, from_person_id: PERSON1, to_person_id: PERSON2, type: 'spouse_of', subtype: 'current' }],
];

for (const [method, url, body] of tests) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const short = text.length > 100 ? text.slice(0, 100) + '...' : text;
  const path = url.replace(BASE, '');
  console.log(`${method} ${path}: ${res.status} → ${short}`);
}
