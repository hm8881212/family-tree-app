const res = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mebaburao888@gmail.com', password: 'Admin1234!' })
});
const text = await res.text();
console.log('status:', res.status);
console.log('body:', text);
