const loginRes = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mebaburao888@gmail.com', password: 'Admin1234!' })
});
const cookies = loginRes.headers.raw?.()['set-cookie']?.join('; ') ?? loginRes.headers.get('set-cookie') ?? '';
console.log('Login:', loginRes.status);

const propRes = await fetch('http://localhost:4000/api/families/bffba656-8943-48ed-b89d-4f76a4f09b5a/proposals', {
  headers: { Cookie: cookies }
});
const data = await propRes.json();
console.log('Proposals:', JSON.stringify(data, null, 2));
