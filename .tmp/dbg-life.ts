import { unsupportedFacts } from '@/lib/quality-checks';
for (const t of ['我每天早上五点就到店，七点开始备货。', '我妈住院那年，我差点把店关了。', '那时候我欠了二十万，只能硬着头皮干。', '当了五年教师，辞职那天我妈哭了，她说你大学毕业好不容易。']) console.log(JSON.stringify(unsupportedFacts(t, '')));
