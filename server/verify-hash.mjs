import argon2 from 'argon2';
const hash = '$argon2id$v=19$m=65536,t=3,p=4$VmQSCDmn6ODrCQx205MBgg$Tb/dkadWG27h/PLJzBYnzz6ZL8QmaKAFh+EO6fzeT4Q';
const match = await argon2.verify(hash, 'Admin1234!');
console.log('password match:', match);
