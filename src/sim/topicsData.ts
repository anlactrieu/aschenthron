/**
 * P2 Gespräche: Themen der NPCs. Eigene Texte, nichts aus anderen Spielen übernommen.
 *
 * Stichworte stehen im Text als `[[schluessel|Anzeigewort]]`. Wer einen Text liest, merkt sich alle Stichworte darin.
 * Ein Thema ist frei anklickbar, wenn sein Stichwort in der `open`-Zeile des NPC steht; alle anderen Themen
 * (Spalte „versteckt“) gibt es nur, wenn das Stichwort schon aus einem anderen Gespräch bekannt ist.
 * Antworten mit `quest` schalten beim ersten Fragen einen versteckten Auftrag frei (Definition in data.ts, `hidden`).
 */
export interface TopicAnswer {
  text: string[];
  /** Darunter weicht der NPC aus (`tooLow`), nichts wird freigeschaltet */
  minLevel?: number;
  tooLow?: string;
  /** Versteckter Auftrag, der beim ersten Fragen angenommen wird */
  quest?: string;
  /** Zusatz, sobald der Auftrag abgegeben ist */
  done?: string;
}

export interface NpcTopics {
  /** Einstiegszeile mit den frei anklickbaren Stichworten */
  open: string;
  topics: Record<string, TopicAnswer>;
}

export const NPC_TOPICS: Record<string, NpcTopics> = {
  // ------------------------------------------------------------ Nacht-NPCs (P6, nur nachts da)
  'Hehler Grau': {
    open: 'Frag nach der [[nachtware|Ware]], der [[nachtschicht|Nachtschicht]] oder nach den [[grabgaenger|Grabgängern]] vor der Stadt.',
    topics: {
      nachtware: { text: ['Was ich habe, gibt es bei Tag nirgends zu kaufen: Anhänger aus den Gräbern, Ringe ohne Herkunft, Tränke für große Wunden. Die Händler am Markt sperren bei Einbruch der Dunkelheit zu, ich sperre dann erst auf.'] },
      nachtschicht: { text: ['Von der Nachtschicht lebe ich. Die Wachen drücken beide Augen zu, solange kein Blut fließt, und der Rest der Stadt schläft. Wenn du Kundschaft sein willst, komm nach Einbruch der Dunkelheit, bis zum Morgengrauen.'] },
      grabgaenger: { text: ['Die Toten steigen nachts aus den Gräbern, auf dem Totenacker und im Moor zahlreicher als am Tag, und sie schlagen härter zu. Bei Sonnenaufgang sind sie wieder fort. Wer nachts jagt, bekommt mehr Erfahrung und mehr Ärger.'] },
    },
  },
  'Nachthändlerin Vess': {
    open: 'Frag nach den [[nachtjaeger|Nachtjägern]], dem [[hehlerhafen|Hehler im Hafen]] oder dem [[morgengrauen|Morgengrauen]].',
    topics: {
      nachtjaeger: { text: ['Wölfe jagen im Dunkeln größer und mutiger. Im Hochland die Schattenwölfe, in der Aschenöde die Nachtjäger. Sie wittern dich weiter als bei Tag, also halte Tränke bereit.'] },
      hehlerhafen: { text: ['Im Hafen sitzt ein Kerl namens Grau, der dasselbe verkauft wie ich. Ich bin besser sortiert, er ist billiger. Such dir aus, wem du eher traust.'] },
      morgengrauen: { text: ['Mit dem ersten Licht ziehen sich die Nachtgänger zurück und die Läden öffnen wieder. Ich auch. Wer die Nacht überlebt hat, sollte schlafen gehen.'] },
    },
  },
  'Totengräber Hobb': {
    open: 'Frag nach den [[gruber|Gräbern]], dem [[nachtdienst|Nachtdienst]] oder dem [[morgenlicht|Morgenlicht]].',
    topics: {
      gruber: { text: ['Ich begrabe, was tagsüber liegen bleibt. Nachts gräbt sich einiges von allein wieder aus. Auf dem Totenacker mehr als irgendwo sonst.'] },
      nachtdienst: { text: ['Tagsüber schlafe ich, nachts bin ich in der Stadt unterwegs. Draußen lege ich mich nicht mehr hin, seit mir ein Skelett die Schaufel weggenommen hat.'] },
      morgenlicht: { text: ['Das erste Licht schickt sie zurück. Wer in der Dämmerung auf den Wegen bleibt, kommt meist durch.'] },
    },
  },
  // ------------------------------------------------------------ Aschenhafen
  'Hafenmeister Joren': {
    open: 'Frag mich nach dem [[hafen|Hafen]], den [[wege|Wegen]] aus der Stadt oder dem [[nebel|Nebel]], der abends vom Wasser kommt.',
    topics: {
      hafen: { text: ['Aschenhafen lebt von dem, was die Schiffe nicht mehr bringen. Früher kamen Gewürze und Wolle, heute Flüchtlinge und Schmuggelware. Beides lade ich ab, ohne Fragen: Ein Hafenmeister, der Fragen stellt, lebt nicht lange.'] },
      wege: { text: ['Nach Osten führt die Handelsstraße zur [[felsenwacht|Felsenwacht]], ein langer Marsch durch Wald und Moor. Im Norden liegen die Roggenfelder, im Westen der Düsterwald. Bleib auf den Wegen, bis du Stufe zehn erreicht hast.'] },
      nebel: { text: ['Der Nebel kriecht seit dem Fall des Throns vom Wasser her. Die Fischer behaupten, er rieche nach Asche. Ich behaupte, er riecht nach Fisch, und bin trotzdem froh, wenn die Laternen brennen.'] },
      felsenwacht: { text: ['Die Felsenwacht ist unsere Schwesterstadt im Osten, eine Festung am Bergpass. Dort sitzt, wer mit Waffen mehr zu tun hat als mit Netzen. Wenn du Neuigkeiten willst, frag [[haldor|Haldor]] am Tor.'] },
      haldor: { text: ['Haldor steht seit Jahrzehnten am Tor der Felsenwacht und hört alles. Wer ihm zuhört, erfährt mehr als von jedem Ausrufer.'] },
      tam: {
        minLevel: 5,
        tooLow: 'Tam? Ein Name, mit dem ich dich nicht belasten will, solange du noch Ratten jagst. Komm wieder, wenn du dich im Wald zurechtfindest.',
        text: ['Tam, der junge Kerl aus dem Lehrhaus? Er wollte im Düsterwald Spinnenseide für Varn holen und kam nie zurück. Das war im Frühjahr. Sieh nach, ob du im Unterholz etwas von ihm findest. Ich zahle dafür aus der Hafenkasse.'],
        quest: 'h_tam1',
        done: 'Die Sache mit Tam geht mir nach. Danke, dass du dich kümmerst.',
      },
    },
  },
  'Lehrer Varn': {
    open: 'Ich lehre den [[kampf|Kampf]] und das [[durchhalten|Durchhalten]]. Wer mehr über das [[lehrhaus|Lehrhaus]] wissen will, darf fragen.',
    topics: {
      kampf: { text: ['Nahkampf ist Geduld: warten, bis der Gegner den Fehler macht. Fernkampf ist Abstand. Überleben ist, beides zu verbinden. Such dir einen Stil und bleib ihm treu, bis er sitzt.'] },
      durchhalten: { text: ['Wer Tränke spart, stirbt gespart. Trink früh, nicht spät. Und wer zu viel Rüstung trägt, ist am Ende schneller müde als der Gegner.'] },
      lehrhaus: { text: ['Früher bildeten wir zwanzig Schüler im Jahr aus, jetzt sind es drei. Einer davon, [[tam|Tam]], war mein bester. Er ist seit dem Frühjahr fort. Der Hafenmeister führt Buch über jeden, der die Stadt verlässt.'] },
      giftmutter: {
        minLevel: 8,
        tooLow: 'Dieses Wesen ist nichts für dich, solange du noch lernst, einen Hieb zu parieren. Komm wieder, wenn du stärker bist.',
        text: ['Giftmutter Zischel? Dann haben die Spinnen ihn also verschleppt. Er lebt, ich fühle es, sonst hätte Brandt nicht seinen Dolch gefunden. Erlege sie und bring mir, was er trug.'],
        quest: 'h_tam3',
        done: 'Tam liegt bei Kräuterfrau Odda und schläft sich gesund. Ich schulde dir mehr als Gold.',
      },
    },
  },
  'Magierin Selka': {
    open: 'Ich lehre die [[magie|Magie]] und warne vor ihren [[grenzen|Grenzen]]. Wenn du dich traust, frag nach der [[asche|Asche]].',
    topics: {
      magie: { text: ['Feuer, Frost und Heilung folgen alle demselben Gesetz: Was du gibst, musst du erst besitzen. Wer Mana verschwendet, steht im Kampf mit leeren Händen da.'] },
      grenzen: { text: ['Die Alten nannten es das Gesetz der drei Atemzüge: sammeln, binden, loslassen. Wer überstürzt, verbrennt sich zuerst selbst.'] },
      asche: { text: ['Seit der Thron fiel, gehorcht Feuer anders. Es wirkt gieriger. Ich mag nicht, was die Asche aus meinen Schülern macht, und ich mag noch weniger, dass sie es mögen.'] },
    },
  },
  'Händlerin Mirel': {
    open: 'Ich handle mit [[waren|Waren]] und höre, was Kunden sonst keinem sagen, etwa über [[kundschaft|Kundschaft]], die lieber nachts kommt.',
    topics: {
      waren: { text: ['Waffen für den Anfang, Tränke für den Notfall. Was du nicht brauchst, kaufe ich dir ab, nicht zum Höchstpreis, aber ehrlich. Die besten Stücke findest du bei den Bossen, nicht bei mir.'] },
      kundschaft: { text: ['Manche Kunden zahlen in alter Münze und fragen nie nach dem Wechselgeld. Ich frage nicht zurück. Nur dass ich zwei von ihnen nicht mehr sehe, macht mich nachdenklich.'] },
      schmugglerbuch: {
        minLevel: 10,
        tooLow: 'Ein Buch, das Räuberhauptleute führen, ist nichts für Anfänger. Komm wieder, wenn du ein paar Lager hinter dir hast.',
        text: ['Kolms Buch, sagst du? Dann kenne ich die Namen, die darin stehen: Mittelsmänner, die auch bei mir einkaufen. Die Fäden laufen im Räuberlager zusammen. Schalte drei Räuberhauptleute aus, dann reißen sie.'],
        quest: 'h_rot3',
        done: 'Seit die Hauptleute fort sind, sind meine nächtlichen Kunden verschwunden. Mein Lager ist leerer, aber ruhiger.',
      },
    },
  },
  'Händler Wenzel': {
    open: 'Ich rüste Leute mit [[sonderwuenschen|Sonderwünschen]] aus: Stäbe, Schilde, [[ringe|Ringe]].',
    topics: {
      sonderwuenschen: { text: ['Nicht jeder will ein Schwert. Mancher will einen Stab, ein Schild, einen Ring, der etwas flüstert. Ich beschaffe, was Mirel für Unfug hält.'] },
      ringe: { text: ['Ringe sind die ehrlichsten Dinge der Welt: klein, schwer zu fälschen und immer etwas wert. Aber trag keinen, den du auf einem Toten gefunden hast, ohne ihn der Schmiedin zu zeigen.'] },
    },
  },
  'Schmiedin Ilse': {
    open: 'Ich [[aufwerten|werte auf]], was du bringst, und weiß einiges über [[edelsteine|Edelsteine]].',
    topics: {
      aufwerten: { text: ['Normal, magisch, selten: Jede Stufe kostet mehr Gold, und nicht jeder Rohling hält sie aus. Benannte Stücke fasse ich nicht an, die haben ihr Gesicht schon.'] },
      edelsteine: { text: ['Ein Edelstein im Sockel ist wie ein Geheimnis im Gürtel: erst wertlos, dann unbezahlbar. Ich setze sie, du zahlst. Ersetzt du einen, zerbricht der alte.'] },
    },
  },
  'Lagerverwalter Ottmar': {
    open: 'Ich verwahre dein [[lager|Lager]], und manchmal auch ein [[geheimnis|Geheimnis]].',
    topics: {
      lager: { text: ['Alles in meiner Truhe ist sicher, auch wenn du stirbst. Zwei Städte, ein Lager: Torvin in der Felsenwacht öffnet dieselbe Truhe.'] },
      geheimnis: { text: ['Ich sage nie, was Leute bei mir einschließen. Aber ich merke, wer nur Münzen bringt und wer Bücher mit Wachssiegeln.'] },
    },
  },
  'Hauptmann Brandt': {
    open: 'Die Wache sucht Hilfe gegen [[raeuber|Räuber]], [[goblins|Goblins]] und alles, was nachts schreit.',
    topics: {
      raeuber: { text: ['Im Nordwesten liegt das Räuberlager, geführt von Harkon. Davor streifen Lehrlinge und Wegelagerer durch den Wald. Ohne Rüstung ist das kein Ausflug.'] },
      goblins: { text: ['Die Goblins graben, plündern und lieben Feuer. Das Beste gegen sie ist eine breite Straße und ein scharfes Schwert. Wer hundert von ihnen erlegt, dem schulde ich einen Krug.'] },
      rotschal: {
        minLevel: 4,
        tooLow: 'Dieser Name taucht in den Berichten auf, aber du bist noch zu grün, um ihm nachzugehen. Komm wieder, wenn du ein paar Aufträge hinter dir hast.',
        text: ['Rotschal… Ich kenne die Sorte: Händler ohne Papiere, die nachts im Hafen ablegen. Ihre Spuren führen ins Räuberlager, wo die Räuber rote Fetzen am Gürtel tragen. Bring mir vier davon, dann habe ich etwas in der Hand.'],
        quest: 'h_rot1',
        done: 'Mit den Fetzen konnte ich die Wache im Hafen verdoppeln. Rotschal macht seitdem einen Bogen um uns.',
      },
      netz: {
        minLevel: 6,
        tooLow: 'Spinnen im Wald sind kein Spaß, und du siehst noch nicht aus, als wüsstest du das. Komm wieder, wenn du stärker bist.',
        text: ['Taschenreste im Wald? Dann stimmt, was ich fürchte: In der Spinnenhöhle im Düsterwald haust eine Brut, die schon mehr als Tam verschluckt hat. Säubere die Höhle, ich schreibe es dir gut.'],
        quest: 'h_tam2',
        done: 'Die Höhle ist ruhig. Die Wache dankt dir, und ich auch.',
      },
    },
  },
  'Kräuterfrau Odda': {
    open: 'Ich sammle [[kraeuter|Kräuter]] und weiß, wer [[schlafmohn|Schlafmohn]] kauft.',
    topics: {
      kraeuter: { text: ['Irrlichtkraut im Moor, Blutmoos im Wald, Nachtschatten auf dem Totenacker. Das Moor ist gefährlicher, als es aussieht: Die Ghule stehen dort, wo das beste Kraut wächst.'] },
      schlafmohn: { text: ['Schlafmohn lässt Verwundete ruhen und manche Händler zu lange schlafen. Einer kauft ihn jede Woche nachts im Sack, zahlt gut und redet nicht. Er trägt einen roten Schal, die Leute nennen ihn [[rotschal|Rotschal]].'] },
    },
  },
  'Chronistin Maren': {
    open: 'Ich führe die [[chronik|Chronik]] und suche [[zeugen|Zeugen]].',
    topics: {
      chronik: { text: ['Seit dem Fall des Throns schreibe ich jede Nacht eine Seite. Manche Kapitel sind zu dunkel, um sie zu Ende zu bringen.'] },
      zeugen: { text: ['Zeugen sind selten geworden. Der Eremit im Moor, der Ritter in der Asche, der Schatzsucher in der Mine: Alle haben gesehen, was ich nicht sehen durfte.'] },
      siegelring: {
        minLevel: 20,
        tooLow: 'Aldrics Ring ist eine Geschichte für später. Die Öde frisst Schwächere, als du es bist. Komm wieder, wenn du dort bestehst.',
        text: ['Aldrics Siegelring besiegelte einen Eid, den die Chronik nicht festhalten konnte: Beim Fall des Throns verbrannte ein Teil meiner Seiten, die Fetzen treiben noch durch die Öde. Sammle fünf verbrannte Seiten von den Wesen dort, dann lese ich dir vor, was der Ring bedeutet.'],
        quest: 'h_asche1',
        done: 'Ich habe die Seiten zusammengesetzt. Danke, ohne dich blieben sie Asche.',
      },
    },
  },

  // ------------------------------------------------------------ Felsenwacht
  'Meisterin Kjorra': {
    open: 'Ich lehre den Kampf. Frag nach der [[wache|Wache]] oder den [[narben|Narben]], wenn du Mut hast.',
    topics: {
      wache: { text: ['Die Felsenwacht hält den Pass. Wer hier dient, lernt zwei Dinge: Dienst und Schweigen. Das zweite fällt den meisten schwerer.'] },
      narben: { text: ['Jede Narbe ist eine Lektion, die jemand anderes nicht überlebt hat. Zeig mir deine, dann sage ich dir, wie gut du bist.'] },
      turm: {
        minLevel: 13,
        tooLow: 'Der Weg zum Turm ist kein Ort für jemanden, der noch nach dem Weg fragt. Komm wieder, wenn du die Katakomben nicht mehr fürchtest.',
        text: ['Der Glockenturm, in dem Sael einst läutete? Er steht in den Katakomben im Osten. Ich schicke keine Schüler, die den Rückweg nicht kennen. Aber wenn du die Glocke zum Schweigen bringen willst, sieh dir den Eingang an und komm lebend wieder.'],
        quest: 'h_glo3',
        done: 'Du hast den Turm gesehen und kamst zurück. Das ist mehr, als ich von den meisten Schülern sagen kann.',
      },
    },
  },
  'Erzmagier Orvan': {
    open: 'Ich unterrichte die [[zauber|Zauberei]]. Fragt man mich nach dem [[totenacker|Totenacker]], werde ich einsilbig.',
    topics: {
      zauber: { text: ['Magie ist Rechnen mit Dingen, die nicht rechnen wollen. Wer mehr will als Funken, braucht Verstand, Willenskraft und die Geduld, ein Buch zweimal zu lesen.'] },
      totenacker: { text: ['Südlich der Stadt liegt der Totenacker. Dort ruhen die Toten, oder auch nicht. Ich habe nachts ein Geräusch gehört, das ich sonst nur aus alten Büchern kenne: eine [[glocke|Glocke]], wo keine ist.'] },
      glocke: {
        minLevel: 9,
        tooLow: 'Die Glocke zu verstehen, braucht mehr, als du bisher gelernt hast. Komm wieder, wenn der Totenacker kein fremdes Wort mehr für dich ist.',
        text: ['Du hast sie also gehört. Die Glocke ruft nicht die Lebenden. Sammle fünf Glockensplitter von den Untoten auf dem Totenacker, ich will wissen, wovon ihr Klang trägt, bevor ich dir mehr sage.'],
        quest: 'h_glo1',
        done: 'Der Klang trägt einen Namen: Sael. Frag, wer ihn kennt.',
      },
    },
  },
  'Händler Dorn': {
    open: 'Ich handle mit Waren für Fortgeschrittene und weiß, wer sie braucht: [[soeldner|Söldner]], [[jaeger|Jäger]] und Narren.',
    topics: {
      soeldner: { text: ['Söldner zahlen schlecht und kaufen oft. Jäger zahlen gut und kaufen wenig. Narren zahlen immer, leider nur einmal.'] },
      jaeger: { text: ['Die Jäger der Felsenwacht gehen ins Hochland, wo die Trolle brüllen. Wer von dort lebend zurückkommt, kauft bei mir den besten Bogen.'] },
    },
  },
  'Schmied Torgal': {
    open: 'Mein [[eisen|Eisen]] kommt aus der Mine und ist das beste weit und breit. Nur über das [[feuer|Feuer]] sprich nicht mit mir.',
    topics: {
      eisen: { text: ['Das Eisen vom Totenacker rostet nie, aber wer es schmiedet, hört nachts eine [[glocke|Glocke]] im Amboss. Ich nehme es trotzdem, wenn ich muss.'] },
      feuer: { text: ['Mein Feuer brennt kalt, wenn jemand die Asche des Throns zur Esse trägt. Schmiede wissen solche Dinge früher als Magier.'] },
    },
  },
  'Wachführerin Tessa': {
    open: 'Die Wache der Felsenwacht jagt [[anfuehrer|Anführer]] und fürchtet die [[brut|Brut]] der Asche.',
    topics: {
      anfuehrer: { text: ['Champions erkennt man an der Aura. Sie sammeln Rudel um sich wie Hirten ihre Schafe. Eins nach dem anderen fällt, wenn man den Anführer zuerst nimmt.'] },
      brut: { text: ['Im Osten, nahe der Aschenöde, sammeln sich Wesen, die nicht dorthin gehören. Etwas ruft sie, und es spricht nicht in Worten.'] },
      ascheneid: {
        minLevel: 25,
        tooLow: 'Davon sprichst du, bevor du Todesritter gesehen hast. Komm wieder, wenn du ihren Anblick aushältst.',
        text: ['Valdors Eid ist gebrochen? Dann stehen seine Ritter jetzt führerlos in der Öde. Brich ihre Reihen, drei Todesritter genügen, dann kommt dein Name ins Wachbuch.'],
        quest: 'h_asche3',
        done: 'Dein Name steht im Wachbuch. Es sind nicht viele.',
      },
    },
  },
  'Späher Ruven': {
    open: 'Ich spähe im Hochland und habe viel gesehen: die [[trolle|Trolle]], die [[pforte|Pforte]] im Osten.',
    topics: {
      trolle: { text: ['Die Hochlandtrolle sind dumm, aber nicht blind. Sie meiden Feuer, aber nur, solange es groß genug ist.'] },
      pforte: { text: ['Hinter der Aschenöde liegt der Aschengrund. Dort steht eine Pforte, die man nur erreicht, wenn man Zarkeshs Glut überlebt hat. Wer weiter will, braucht mehr als Mut.'] },
      valdor: {
        minLevel: 24,
        tooLow: 'Valdor frisst Leute wie dich zum Frühstück. Komm wieder, wenn du ihn nicht mehr beim Namen fürchtest.',
        text: ['Schreckensritter Valdor? Er war einst Aldrics Waffenbruder, heute führt er eine Schar Untoter durch die Öde. Wenn der Ritter von ihm erzählt, hat er Grund. Erschlag ihn und bring mir sein Wappen.'],
        quest: 'h_asche2',
        done: 'Sein Wappen hängt jetzt bei den Gefallenen. Die Öde ist ein Stück sicherer.',
      },
    },
  },
  'Torwache Haldor': {
    open: 'Am Tor hört man alles: von [[reisenden|Reisenden]], vom [[moor|Moor]] und davon, was [[nachts|nachts]] läutet.',
    topics: {
      reisenden: { text: ['Händler, Pilger, Flüchtlinge. Die Händler erzählen von Preisen, die Pilger von Wundern, die Flüchtlinge von dem, was wirklich geschah.'] },
      moor: { text: ['Im Moor sitzt Olm, der Eremit. Hinter ihm lauert Veshra, und noch tiefer Gurrak. Das Moor schluckt, was nicht singen kann.'] },
      nachts: { text: ['Nachts hört man am Tor manchmal eine Glocke vom Totenacker. Die Wache sagt, es sei der Wind. Der Wind läutet nicht im Takt, und er läutet nicht für einen einzigen.'] },
      sael: {
        minLevel: 12,
        tooLow: 'Sael ist kein Name für Neulinge. Komm wieder, wenn du ein Gespenst nicht mehr für ein Märchen hältst.',
        text: ['Sael? Geistfürst Sael läutete einst die Glocke im Turm. Seit dem Fall des Throns ruft sie ihn zurück, und er haust am Totenacker. Bann ihn, dann schweigt die Glocke vielleicht, und ich schlafe wieder.'],
        quest: 'h_glo2',
        done: 'Die Glocke ist stiller geworden. Die Nacht am Tor hat wieder ihre Ruhe.',
      },
    },
  },
  'Lagerverwalter Torvin': {
    open: 'Mein [[lager|Lager]] ist dasselbe wie das in Aschenhafen. Frag mich nach den [[diebe|Dieben]], wenn du magst.',
    topics: {
      lager: { text: ['Gleiche Truhe wie in Aschenhafen: Du legst dort ab, ich gebe hier zurück. Meine Aufgabe ist, das Schloss zu pflegen und den Mund zu halten.'] },
      diebe: { text: ['Diebe kommen nicht zu mir, sie wissen, dass die Truhe an dich gebunden ist. Sie gehen zu den Ständen draußen, wo niemand hinsieht.'] },
    },
  },

  // ------------------------------------------------------------ Wildnis
  'Jägerin Ysa': {
    open: 'Im Räuberlager kennt man mich. Frag nach den [[goblins|Goblins]], dem [[bau|Bau]] oder nach [[spuren|Spuren]].',
    topics: {
      goblins: { text: ['Sie graben tiefer, als wir glauben. Ihr König Grix lebt unter dem Lager, und wo er ist, rücken die Wände näher.'] },
      bau: { text: ['Der Goblinbau liegt im Norden. Der Eingang ist ein Loch, das nach Schweiß riecht. Geh nicht ohne Heilung hinein.'] },
      spuren: { text: ['Ein verlorener Zahn erzählt mehr als zehn Zeugen. Zeig mir Zeichen, und ich sage dir den Weg.'] },
      tunnel: {
        minLevel: 8,
        tooLow: 'Der alte Tunnel ist nichts für einen Anfänger. Komm wieder, wenn du Räuber nicht mehr zählst.',
        text: ['Der alte Schmugglertunnel unter dem Lager? Den kenne ich. Hauptmann Kolm bewacht ihn und führt Buch über alles, was durchgeht. Willst du das Buch, musst du ihn erledigen.'],
        quest: 'h_rot2',
        done: 'Das Buch lag in seinem Gürtel. Die Namen darin sind für Leute wie Mirel von Wert.',
      },
    },
  },
  'Eremit Olm': {
    open: 'Frag nach [[veshra|Veshra]], [[gurrak|Gurrak]] oder dem [[moorwind|Moorwind]].',
    topics: {
      veshra: { text: ['Sie war meine Schwester im Handwerk. Ihr Kummer war größer als das Moor, und das Moor hat ihn aufgenommen.'] },
      gurrak: { text: ['Der Verschlinger sitzt in den Moorlanden und frisst, was sich bewegt. Wenn du ihn siehst, hast du ihn meist schon zu lange gesehen.'] },
      moorwind: { text: ['Der Moorwind trägt Stimmen. Manche sind Geister, manche Erinnerungen, und manchmal ist es nur der Wind.'] },
      glocke: { text: ['Auch ins Moor trägt sie der Wind: eine Glocke, die man nicht zum Gebet läutet. Frag Haldor am Tor, er steht näher am Totenacker als ich.'] },
    },
  },
  'Schatzsucher Pell': {
    open: 'Frag nach der [[mine|Mine]], den [[truhen|Truhen]] oder den [[spinnen|Spinnen]], die darin hausen.',
    topics: {
      mine: { text: ['Die Tiefenmine hat vierzig Gänge, und ich kenne neununddreißig. Den vierzigsten hat eine Spinne bezogen, die ich nicht kennenlernen will.'] },
      truhen: { text: ['Wer eine Truhe findet, sollte zuerst horchen. Truhen schweigen nur, wenn nichts drinnen lauert.'] },
      spinnen: { text: ['Webmutter Skarra herrscht im letzten Gang. Wer ihr Netz sieht, hat noch eine Chance. Wer es spürt, keine.'] },
    },
  },
  'Ritter Aldric': {
    open: 'Ich bin der Letzte des [[eid|Eids]]. Frag nach dem [[thron|Thron]], wenn du die Antwort verkraftest.',
    topics: {
      eid: { text: ['Wir schworen auf einen [[siegelring|Siegelring]], dreißig Namen eingraviert, einer für jeden von uns. Ich trage ihn nicht mehr.'] },
      thron: { text: ['Der Thron brennt noch, auch wenn man ihn nicht sieht. Wer ihn berührt, wird selbst zur Asche, ohne es zu merken.'] },
      siegelring: { text: ['Er zersprang beim Fall des Throns. Die Splitter treiben in der Öde, wie Treibgut. Wer sie sammelt, sammelt unsere Namen.'] },
      valdor: { text: ['Valdor war mein Waffenbruder. Er hielt den Schwur länger als jeder, und deshalb brach er schlimmer als alle. Wenn du ihm begegnest, schlag zu, ohne zu zögern.'] },
    },
  },
};

/**
 * Notizen der Landmarken (P5) hängen an Stichworten (P2): wer die Notiz liest, notiert das Stichwort.
 * Schlüssel = Landmarken-Id der Karte (`lm…`). Lagerfeuer lm7 und lm25 sind reine Stimmung.
 */
export const LANDMARK_TOPICS: Record<string, string> = {
  lm3: 'spuren',
  lm4: 'moor',
  lm6: 'rotschal',
  lm10: 'bau',
  lm12: 'moorwind',
  lm13: 'veshra',
  lm17: 'nachts',
  lm19: 'mine',
  lm20: 'pforte',
  lm24: 'thron',
};
