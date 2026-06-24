// Daily reminder wordings — Almond voice (tu, encourageant, clin d'œil sec ;
// monde de la légèreté / forme / flamme, jamais cuisine ni calories). The cron
// rotates through them deterministically by day-of-year so the same text never
// lands two evenings in a row.
export interface ReminderWording {
  title: string;
  body: string;
}

export const REMINDER_WORDINGS: ReminderWording[] = [
  {
    title: "Ta journée t'attend",
    body: 'Trois repas à poser, ni balance ni calcul. On garde la flamme ? 🔥',
  },
  {
    title: 'On range les écarts sous le tapis ?',
    body: 'Note ta journée avant minuit, on efface l’ardoise demain.',
  },
  {
    title: 'La flamme te regarde de travers',
    body: 'Deux minutes pour la rassurer. File noter ta journée. 🔥',
  },
  {
    title: 'Léger, comme toujours',
    body: 'Pas de calories à compter, juste ta journée à poser. On y va ?',
  },
  {
    title: 'Promis, demain plus léger',
    body: "Mais d'abord, note aujourd'hui. La flamme insiste.",
  },
  {
    title: 'Petit oubli ?',
    body: "Ta journée n'est pas encore notée. On répare ça en 30 secondes.",
  },
  {
    title: "21h30, l'heure du bilan",
    body: "Comment s'est passée ta journée ? Pose-la avant qu'elle file.",
  },
  {
    title: 'Ne laisse pas filer la flamme',
    body: 'Une série, ça se cultive un soir à la fois. À toi de jouer. 🔥',
  },
  {
    title: 'Juste avant de dormir',
    body: 'Trois repas, un geste. Ta journée mérite sa place dans le journal.',
  },
  {
    title: 'On vise plus léger',
    body: "Et on commence par noter aujourd'hui. La balance n'a pas son mot à dire.",
  },
  {
    title: 'Ta série compte sur toi',
    body: 'Encore un soir de noté et la flamme tient. On la garde ? 🔥',
  },
  {
    title: "Coucou, c'est ton journal",
    body: 'Je me sens un peu vide ce soir. Tu passes me remplir ?',
  },
];

// Where the notification tap lands — the day-entry screen (cf. produit : « au tap
// on ouvre la saisie du jour »).
export const REMINDER_URL = '/home';

// Single key so the OS coalesces repeated reminders instead of stacking them.
export const REMINDER_TAG = 'foody-daily-reminder';
