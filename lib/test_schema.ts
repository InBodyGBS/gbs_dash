type Test1 = { id: string; name: string } extends Record<string, unknown> ? 'YES' : 'NO';
type Test2 = { id: string; category: 'a' | 'b' } extends Record<string, unknown> ? 'YES' : 'NO';
declare const t1: Test1;
declare const t2: Test2;
void t1;
void t2;
