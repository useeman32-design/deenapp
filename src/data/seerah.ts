/** Seerah timeline (pass 16) — key events from pre-birth to the passing of the Prophet ﷺ. */
export type SeerahEvent = {
  id: number;
  year: string;
  title: string;
  desc: string;
  icon: string;
};

export const SEERAH: SeerahEvent[] = [
  { id: 1, year: '570 CE', title: 'The Year of the Elephant', desc: 'Birth of the Prophet Muhammad ﷺ in Makkah; Abraha’s army is destroyed.', icon: 'star' },
  { id: 2, year: '576 CE', title: 'Childhood & Aminah’s passing', desc: 'His mother Aminah passes away at Abwa; he is raised by his grandfather Abdul-Muttalib, then his uncle Abu Talib.', icon: 'child' },
  { id: 3, year: '595 CE', title: 'Marriage to Khadijah', desc: 'The trustworthy 25-year-old marries Khadijah bint Khuwaylid, may Allah be pleased with her.', icon: 'heart' },
  { id: 4, year: '605 CE', title: 'The Black Stone arbitration', desc: 'He settles the dispute over the placement of the Black Stone, earning the title Al-Amin.', icon: 'cube' },
  { id: 5, year: '610 CE', title: 'First revelation', desc: 'Jibril brings the first verses of Surah Al-Alaq in the Cave of Hira during Ramadan.', icon: 'book-open' },
  { id: 6, year: '613 CE', title: 'Public call to Islam', desc: 'After three quiet years, the Prophet ﷺ calls Makkah openly to worship Allah alone.', icon: 'bullhorn' },
  { id: 7, year: '615 CE', title: 'Migration to Abyssinia', desc: 'Persecuted companions find refuge with the just king Negus (an-Najashi).', icon: 'ship' },
  { id: 8, year: '619 CE', title: 'Year of Sorrow', desc: 'Khadijah and Abu Talib pass away; the Prophet ﷺ is stoned at Ta’if.', icon: 'cloud-rain' },
  { id: 9, year: '620 CE', title: 'Isra & Miraj', desc: 'The night journey to Jerusalem and ascension through the heavens; the five daily prayers are gifted.', icon: 'moon' },
  { id: 10, year: '620 CE', title: 'Pledges of Aqabah', desc: 'Delegations from Yathrib (Madinah) pledge allegiance and invite the Prophet ﷺ.', icon: 'handshake' },
  { id: 11, year: '622 CE', title: 'The Hijrah', desc: 'The migration to Madinah; the Islamic calendar begins from this year.', icon: 'route' },
  { id: 12, year: '624 CE', title: 'Battle of Badr', desc: '313 believers defeat a far larger Quraysh army on the 17th of Ramadan.', icon: 'shield-alt' },
  { id: 13, year: '625 CE', title: 'Battle of Uhud', desc: 'A test near Mount Uhud; martyrdom of Hamzah and 70 companions.', icon: 'mountain' },
  { id: 14, year: '627 CE', title: 'Battle of the Trench', desc: 'Madinah is defended with a trench; a storm scatters the confederates.', icon: 'hammer' },
  { id: 15, year: '628 CE', title: 'Treaty of Hudaybiyyah', desc: 'A seemingly humble peace that opens the doors to mass acceptance of Islam.', icon: 'file-signature' },
  { id: 16, year: '630 CE', title: 'Conquest of Makkah', desc: 'The Prophet ﷺ enters Makkah with 10,000 and forgives its people.', icon: 'kaaba' },
  { id: 17, year: '632 CE', title: 'The Farewell Pilgrimage', desc: 'The final sermon at Arafah before ~100,000 believers.', icon: 'users' },
  { id: 18, year: '632 CE', title: 'The passing of the Prophet ﷺ', desc: 'He passes in Madinah on 12 Rabi al-Awwal; Abu Bakr becomes the first caliph.', icon: 'bookmark' },
];
