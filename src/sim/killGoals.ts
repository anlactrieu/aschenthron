/**
 * P3 Kill-Ziel als Auftrag: Zu jedem Kill-Ziel einer Beute-Gruppe (100 und 500 Kills, `KILL_GOALS`) gibt es einen versteckten Auftrag.
 *
 * Der Weg: `a` erwähnt das Stichwort `jagd_<gruppe>` in seiner Einstiegszeile (frei anklickbar) und verweist auf `b`.
 * Wer `b` danach fragt, bekommt den Auftrag „Kopfgeld“ (100 Kills). Mit der Abgabe lernt man `jagd2_<gruppe>`; `a` stellt dann
 * das große Kopfgeld (500 Kills). Gezählt wird der Kill-Zähler der Gruppe (Bestiarium), schon Erlegtes zählt also mit.
 * Eigene Texte.
 */
export interface KillGoalSpec {
  /** Beute-Gruppe (`LOOT_GROUPS`) */
  group: string;
  /** Niedrigste Stufe der Gruppe: darunter weicht der NPC aus */
  lv: number;
  /** Gibt das Stichwort aus, gibt Kopfgeld 2 (500) */
  a: string;
  /** Gibt Kopfgeld 1 (100) */
  b: string;
  label1: string;
  label2: string;
  /** Antwort von `a` auf Stichwort 1 */
  rumor: string;
  /** Antwort von `b` auf Stichwort 1 (der Auftrag) */
  bid1: string;
  /** Abschluss von Kopfgeld 1 (nennt Stichwort 2) */
  out1: string;
  /** Antwort von `a` auf Stichwort 2 (der Auftrag) */
  bid2: string;
  out2: string;
}

export const KILL_GOAL_SPECS: KillGoalSpec[] = [
  {
    group: 'rats', lv: 1, a: 'Kräuterfrau Odda', b: 'Hafenmeister Joren', label1: 'Rattenplage', label2: 'Rattenkönigin',
    rumor: 'In meinen Kräuterkisten sitzt jede Woche eine neue. Joren führt Buch über die Ratten am Kai und zahlt für Beweise. Frag ihn nach der [[jagd_rats|Rattenplage]].',
    bid1: 'Hundert Schwänze, dann reden wir über Bezahlung. Was du schon erledigt hast, schreibe ich dir gut. Die Ratten fressen mir die Vorräte aus den Fässern.',
    out1: 'Joren zählt nach und nickt. „Das Kai-Lager atmet auf. Odda hat mehr zu erzählen, wenn du magst: die [[jagd2_rats|Rattenkönigin]].“',
    bid2: 'Hundert war ein Anfang. Wenn du fünfhundert Ratten erschlägst, rührt sich in den Kellern nichts mehr. Das Hafenamt legt etwas drauf, ich bürge dafür.',
    out2: 'Odda lacht über ihr ganzes Gesicht. „Meine Kisten sind sicher. Ich lege dir etwas zurück.“',
  },
  {
    group: 'hounds', lv: 2, a: 'Hafenmeister Joren', b: 'Kräuterfrau Odda', label1: 'Meutenplage', label2: 'Herr der Meute',
    rumor: 'Die Hunde draußen reißen jedes Jahr Schafe und Hirten. Odda kennt die Fährten besser als ich. Sie spricht von der [[jagd_hounds|Meutenplage]].',
    bid1: 'Hunde und Wölfe, hundert Stück, das ist das Mindeste, damit die Weiden wieder sicher sind. Bring sie zur Strecke, ich bezahle gern, was du schon erlegt hast.',
    out1: 'Odda schüttelt die Hände aus. „Danke. Joren will mit dir über den [[jagd2_hounds|Herrn der Meute]] reden.“',
    bid2: 'Fünfhundert, dann gilt dein Name bei jedem Hirten. Das Hafenamt zahlt dir dafür etwas Besonderes aus.',
    out2: 'Joren drückt dir die Hand. „Die Hirten singen von dir.“',
  },
  {
    group: 'goblins', lv: 2, a: 'Händlerin Mirel', b: 'Hauptmann Brandt', label1: 'Goblinplage', label2: 'Goblinkönig',
    rumor: 'Goblins stehlen meine Fuhren, wo sie können. Brandt führt die Liste der Räubernester. Frag ihn nach der [[jagd_goblins|Goblinplage]].',
    bid1: 'Hundert Goblins, dafür zahlt die Wache, was sie hat. Zählt, was du schon erlegt hast. Die Fuhren der Händler sollen wieder durchkommen.',
    out1: 'Brandt nickt knapp. „Das hilft. Mirel weiß noch etwas über den [[jagd2_goblins|Goblinkönig]].“',
    bid2: 'Fünfhundert Goblins. Dann gibt es auf der Straße nur noch Wegelagerer, die einen Namen haben. Die Handelsgilde legt zu, ich auch.',
    out2: 'Mirel rechnet und lächelt dünn. „Meine Karren fahren wieder. Fast ohne Wegzoll.“',
  },
  {
    group: 'bandits', lv: 3, a: 'Händler Wenzel', b: 'Jägerin Ysa', label1: 'Räubergeld', label2: 'Landstraßenschreck',
    rumor: 'Ohne Wachen traue ich mich nicht mehr auf die Landstraße. Ysa im Räuberlager kennt jeden von ihnen. Sie spricht vom [[jagd_bandits|Räubergeld]].',
    bid1: 'Hundert Räuber, so viele, dass es die Lager spüren. Was du schon zur Strecke gebracht hast, zähle ich dazu. Kopfgeld gibt es im Hafen, ich bringe es mit.',
    out1: 'Ysa steckt ihr Messer weg. „Wenzel wartet auf Nachricht. Er hat noch einen Wunsch: den [[jagd2_bandits|Landstraßenschreck]].“',
    bid2: 'Fünfhundert. Das ist kein Gefecht, das ist ein Feldzug. Die Händler sammeln für dich, es ist mehr zusammengekommen, als ich dachte.',
    out2: 'Wenzel zählt Münzen auf den Tisch. „Die Straße ist frei. Sag das keinem Räuber.“',
  },
  {
    group: 'spiders', lv: 4, a: 'Magierin Selka', b: 'Lehrer Varn', label1: 'Spinnenplage', label2: 'Netzkönigin',
    rumor: 'Das Gift der Spinnen verdirbt mir die Zutaten. Varn führt eine Chronik ihrer Nester im Düsterwald und fragt nach der [[jagd_spiders|Spinnenplage]].',
    bid1: 'Hundert Spinnen, aller Arten. Das Lehrhaus zahlt für jedes Nest, das nicht mehr atmet. Was du erlegt hast, zählt mit.',
    out1: 'Varn schließt das Buch. „Der Wald wird heller. Selka hat mir erzählt, es gäbe eine [[jagd2_spiders|Netzkönigin]].“',
    bid2: 'Fünfhundert Spinnen, dann ist der Düsterwald wieder begehbar. Das Lehrhaus und ich legen zusammen, ich nehme dir keine Münze weg.',
    out2: 'Selka verneigt sich leicht. „Die Wissenschaft dankt. Und mein Kräutergarten.“',
  },
  {
    group: 'bog', lv: 6, a: 'Totengräber Hobb', b: 'Eremit Olm', label1: 'Moorfluch', label2: 'Moorbezwinger',
    rumor: 'Was im Moor liegen bleibt, steht irgendwann wieder auf. Der Eremit Olm lebt dort und sammelt Zeugen. Frag ihn nach dem [[jagd_bog|Moorfluch]].',
    bid1: 'Hundert Wesen aus dem Moor. Nimm Fackeln mit und lass dir Zeit. Was du schon erledigt hast, zählt; ich merke es mir.',
    out1: 'Olm lauscht in die Nacht. „Es ist ruhiger. Hobb hat noch etwas für dich, wenn du magst: die [[jagd2_bog|Moorbezwinger]].“',
    bid2: 'Fünfhundert. Dann ist das Moor so still wie ein gut gepflegter Friedhof. Ich lege zurück, was Leute mir hinterlassen haben.',
    out2: 'Hobb setzt die Schaufel ab. „Ruhe in Frieden. Auch du, bis zum nächsten Mal.“',
  },
  {
    group: 'undead', lv: 8, a: 'Schmiedin Ilse', b: 'Totengräber Hobb', label1: 'Totenruhe', label2: 'Totenbanner',
    rumor: 'Die Klingen, die ich schmiede, kommen zur Hälfte von Totengräbern zurück, voller Scharten. Hobb kann mehr sagen zur [[jagd_undead|Totenruhe]].',
    bid1: 'Hundert Untote, Skelette, Geister, Zombies, alle zählen. Wer sie bannt, bekommt von mir einen Anteil. Schon Erlegte schreibe ich dir gut.',
    out1: 'Hobb wischt sich die Hände ab. „Danke. Ilse weiß, wie weit das reicht: die [[jagd2_undead|Totenbanner]].“',
    bid2: 'Fünfhundert Untote. Es sind so viele, dass die Gräber voll sind, bevor du fertig bist. Dafür gibt es ein Stück, das ich für dich zurückgelegt habe.',
    out2: 'Ilse prüft deine Klinge. „Beachtlich. Sie hat Scharten, die ich nicht sehen wollte.“',
  },
  {
    group: 'golems', lv: 15, a: 'Händler Dorn', b: 'Schmied Torgal', label1: 'Steinplage', label2: 'Bergbezwinger',
    rumor: 'Die Trolle in den Bergen stehlen mir die Fracht, die Golems zertrümmern, was übrig bleibt. Torgal braucht ihr Erz. Er spricht von der [[jagd_golems|Steinplage]].',
    bid1: 'Hundert Trolle und Golems. Das gibt mir Erz und dir einen Namen. Was du schon zertrümmert hast, zählt natürlich.',
    out1: 'Torgal wiegt einen Brocken in der Hand. „Gutes Erz. Dorn hat noch mehr Arbeit: die [[jagd2_golems|Bergbezwinger]].“',
    bid2: 'Fünfhundert. Ein Berg weniger Stein auf den Wegen. Ich bezahle aus der Kasse der Karawanen, sie schulden mir einen Gefallen.',
    out2: 'Dorn legt dir eine Münze hin und eine zweite obendrauf. „Für die Wege.“',
  },
  {
    group: 'worms', lv: 21, a: 'Späher Ruven', b: 'Schatzsucher Pell', label1: 'Wurmplage', label2: 'Schrecken der Tiefe',
    rumor: 'In der Tiefenmine kriecht alles, was unten bleiben sollte. Pell gräbt dort nach Schätzen und braucht Luft. Er spricht von der [[jagd_worms|Wurmplage]].',
    bid1: 'Hundert Würmer. Ich kann nicht graben, wenn mir ständig etwas unter den Füßen frisst. Was du schon erlegt hast, schreibe ich dir gut.',
    out1: 'Pell klopft auf eine Wand. „Es knackt nicht mehr. Ruven hat noch einen Auftrag: den [[jagd2_worms|Schrecken der Tiefe]].“',
    bid2: 'Fünfhundert. Dann halte ich meine Schaufel wieder fest. Die Gilde der Schatzsucher legt etwas dazu.',
    out2: 'Ruven nickt. „Die Mine gehört wieder uns. Fast.“',
  },
  {
    group: 'ember', lv: 23, a: 'Wachführerin Tessa', b: 'Ritter Aldric', label1: 'Aschenglut', label2: 'Aschenwanderer',
    rumor: 'Die Glutwesen zerreiben, was wir aufbauen. Aldric hat in der Aschenöde ausgeharrt und führt Buch über ihre Zahl. Frag ihn nach der [[jagd_ember|Aschenglut]].',
    bid1: 'Hundert Glutwesen. Die Wache bezahlt dafür, wie bei jedem Dienst. Was du schon gelöscht hast, zählt mit.',
    out1: 'Aldric neigt den Kopf. „Die Glut wird dünner. Tessa weiß, was als Nächstes kommt: die [[jagd2_ember|Aschenwanderer]].“',
    bid2: 'Fünfhundert Glutwesen. Wer das schafft, trägt zu Recht den Namen. Die Wache und ich legen etwas Besonderes zurück.',
    out2: 'Tessa schreibt deinen Namen ins Wachbuch. „Zum zweiten Mal.“',
  },
  {
    group: 'demons', lv: 24, a: 'Ritter Aldric', b: 'Wachführerin Tessa', label1: 'Höllenbrut', label2: 'Geißel der Hölle',
    rumor: 'Die Dämonen sind nicht zufällig hier, sie suchen etwas. Tessa lässt sie zählen. Frag sie nach der [[jagd_demons|Höllenbrut]].',
    bid1: 'Hundert Dämonen. Mehr kann kein Mensch an einer Front halten. Wer sie schlägt, bekommt von der Wache Gold. Zählt, was du schon erschlagen hast.',
    out1: 'Tessa zieht einen Strich im Wachbuch. „Die Front hält. Aldric hat dir noch etwas zu sagen: die [[jagd2_demons|Geißel der Hölle]].“',
    bid2: 'Fünfhundert. Wer das schafft, braucht keinen Orden mehr, aber ich gebe dir einen Gefallen für die Nachwelt.',
    out2: 'Aldric steht auf. „Das hat vor dir keiner geschafft. Danke.“',
  },
];

/** Kopfgeld-IDs: `k1_<gruppe>` (100 Kills), `k2_<gruppe>` (500 Kills) */
export const killGoalQuestId = (group: string, stage: 1 | 2): string => `k${stage}_${group}`;
export const killGoalKey = (group: string, stage: 1 | 2): string => (stage === 1 ? `jagd_${group}` : `jagd2_${group}`);
