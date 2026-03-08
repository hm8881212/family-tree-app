const BASE = 'http://localhost:4000/api';
const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mebaburao888@gmail.com', password: 'Admin1234!' })
});
const cookie = loginRes.headers.get('set-cookie') ?? '';
const headers = { 'Content-Type': 'application/json', Cookie: cookie };
const FAMILY = 'bffba656-8943-48ed-b89d-4f76a4f09b5a';
const P1 = '1b779380-6c62-49b0-8554-8829b7ac012a';
const P2 = '704281a3-5bcc-442d-add1-dfe5aba9b460';

console.log('Login:', loginRes.status);

// 1. Propose relationship
const relRes = await fetch(`${BASE}/relationships`, {
  method: 'POST', headers,
  body: JSON.stringify({ family_id: FAMILY, from_person_id: P1, to_person_id: P2, type: 'spouse_of', subtype: 'current' })
});
const relBody = await relRes.json();
console.log('Propose relationship:', relRes.status, relBody.message ?? relBody.error);

// 2. Get proposals
const pRes = await fetch(`${BASE}/families/${FAMILY}/proposals`, { headers });
const { proposals } = await pRes.json();
console.log(`Pending proposals: ${proposals.length}`);

// 3. Approve relationship proposal
if (proposals.length > 0) {
  const id = proposals[0].id;
  const aRes = await fetch(`${BASE}/proposals/${id}/approve`, { method: 'POST', headers });
  const aBody = await aRes.json();
  console.log('Approve:', aRes.status, aBody.message ?? aBody.error);
}

// 4. Check tree
const treeRes = await fetch(`${BASE}/families/${FAMILY}/tree`, { headers });
const { persons, relationships } = await treeRes.json();
console.log(`\nTree: ${persons.length} persons, ${relationships.length} relationships`);
relationships.forEach(r => console.log(` ✅ ${r.from_person_id.slice(0,8)} --${r.type}[${r.subtype}]--> ${r.to_person_id.slice(0,8)}`));
