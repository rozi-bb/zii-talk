export type Group = 'daily' | 'work';

export type Topic = {
  id: string;
  name: string;
  group: Group;
  icon: string;
  tint: string;
  ink: string;
  blurb: string;
  situations: string[];
};

/* Pareto: sengaja sedikit. "Saat Kamu Macet" ditaruh pertama karena
   itu yang bikin orang berani ngobrol — bukan kosakata. */
export const TOPICS: Topic[] = [
  {
    id: 'macet',
    name: 'Saat Kamu Macet',
    group: 'daily',
    icon: 'ring',
    tint: '#E9E1FF',
    ink: '#6B36D6',
    blurb: '8 kalimat penyelamat biar obrolan nggak mati di tengah jalan.',
    situations: [
      'Chat naturally, but speak in a way that is a little fast and uses one uncommon word or idiom sometimes. If the learner seems to fumble for a word or hesitates, naturally offer: "you can just say... " or "were you trying to say...?" Never announce that this is a lesson.',
      'Chat naturally about anything, staying fully on what the learner just said. Every third reply or so, phrase your own sentence in a slightly quick or run-on way. If the learner asks you to repeat or slow down, happily do it and say something like "good question, sure". Do not comment on the learner\'s grammar in this situation — that is handled elsewhere.',
    ],
  },
  {
    id: 'kenalan',
    name: 'Kenalan & Basa-basi',
    group: 'daily',
    icon: 'chat',
    tint: '#E9E1FF',
    ink: '#6B36D6',
    blurb: 'Nama, kerjaan, cuaca, weekend — pembuka yang kepakai terus.',
    situations: [
      'You just met the learner at a co-working space. Small talk: name, what they do, how long they have been here.',
      'Monday morning small talk about the weekend.',
    ],
  },
  {
    id: 'pesan',
    name: 'Pesan & Beli',
    group: 'daily',
    icon: 'cup',
    tint: '#FFE8D8',
    ink: '#E0630F',
    blurb: 'Kafe, resto, toko, ojek — transaksi sehari-hari.',
    situations: [
      'You are a friendly barista. The learner is ordering coffee, asking about sizes and paying.',
      'You are a shop assistant. The learner wants to ask the price and whether there is a smaller size.',
    ],
  },
  {
    id: 'cerita',
    name: 'Cerita Kejadian',
    group: 'daily',
    icon: 'clock',
    tint: '#DCEEFF',
    ink: '#1573C4',
    blurb: 'Tadi aku..., kemarin ada... — cerita hal yang udah lewat.',
    situations: [
      'Ask the learner to tell you about something that happened to them recently. Keep pulling for details in past simple.',
    ],
  },
  {
    id: 'pendapat',
    name: 'Pendapat & Rasa',
    group: 'daily',
    icon: 'heart',
    tint: '#FFE0EA',
    ink: '#D63A73',
    blurb: 'Suka, nggak suka, setuju, nolak halus.',
    situations: [
      'Chat about something the learner has an opinion on — a film, a city, a habit. Push them to agree, disagree and soften opinions.',
    ],
  },
  {
    id: 'progres',
    name: 'Update Progres',
    group: 'work',
    icon: 'chart',
    tint: '#D7F4E7',
    ink: '#0A8A61',
    blurb: 'Lagi ngerjain apa, kendalanya apa, kapan kelar.',
    situations: [
      'You are a friendly team lead in a stand-up. Ask what the learner worked on, what is blocking them, and what is next.',
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting Survival',
    group: 'work',
    icon: 'people',
    tint: '#E9E1FF',
    ink: '#6B36D6',
    blurb: 'Interupsi, minta klarifikasi, minta diulang.',
    situations: [
      'You are in a meeting talking a bit fast, sometimes running two points together. Occasionally ask a quick check like "does that make sense?" or "any questions?" so the learner has a natural moment to jump in and ask you to clarify or slow down.',
    ],
  },
  {
    id: 'klien',
    name: 'Ngomong ke Klien',
    group: 'work',
    icon: 'case',
    tint: '#FFF0CE',
    ink: '#B87C00',
    blurb: 'Nanya kebutuhan, kasih estimasi, geser jadwal.',
    situations: [
      'You are a client. The learner needs to ask what you actually need, then give a timeline and reschedule a call.',
    ],
  },
  {
    id: 'interview',
    name: 'Interview & Kenalan Pro',
    group: 'work',
    icon: 'badge',
    tint: '#DCEEFF',
    ink: '#1573C4',
    blurb: 'Ngenalin diri secara profesional, jawab pertanyaan klasik.',
    situations: [
      'You are a warm interviewer. Ask the learner to introduce themselves, then about a project they are proud of.',
    ],
  },
];

export const byId = (id: string): Topic => TOPICS.find((t) => t.id === id) ?? TOPICS[0];

export const situationFor = (t: Topic) =>
  t.situations[Math.floor(Math.random() * t.situations.length)];
