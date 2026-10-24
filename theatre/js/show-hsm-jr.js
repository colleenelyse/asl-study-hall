/* Disney's High School Musical JR. — the show's outline for asl.cool/theatre.
   Structure only: scenes, songs, characters and who is on stage when, worked out from the licensed actor's script.
   The script's words are never stored here. They arrive when the teacher imports the PDF, and are saved encrypted.
   Page numbers are the script's printed page numbers. Story text is our own plain-language summary.
   Minutes are estimates; Teacher mode lets you change them, and loading the performance tracks fills in song lengths. */
window.DEFAULT_SHOW = {
  v: 1,
  id: 'hsm-jr',
  title: 'High School Musical JR.',
  subtitle: 'Disney’s High School Musical JR. · Music Theatre International',
  licenseNote: 'Performed under license from Music Theatre International. Script lines and lyrics are for this cast only.',
  links: { rehearsalFolder: 'https://drive.google.com/drive/folders/1oTAmJVz1E6LtZhVr8uqBhv1ZCpBZ6A_A', performanceFolder: 'https://drive.google.com/drive/folders/1TH1Tp166f7TxQ0-fSAhIeUD4uYuBPolo' },

  groups: [
    { id: 'leads', name: 'Leads' }, { id: 'friends', name: 'Friends' }, { id: 'adults', name: 'Grown-ups' },
    { id: 'featured', name: 'Featured' }, { id: 'ensemble', name: 'Groups' }, { id: 'helpers', name: 'Company Mentors' }
  ],
  // colors (Colleen 2026-10-23): Troy red, Gabriella purple, Sharpay pink, Ryan green, Chad blue, Taylor golden yellow, Zeke orange; the rest any
  characters: [
    { id: 'troy', color: '#d62828', name: 'Troy Bolton', short: 'Troy', group: 'leads', aliases: ['TROY'], desc: 'Captain of the basketball team. Everyone expects him to only play ball, but he finds out he loves to sing.' },
    { id: 'gabriella', color: '#7b2cbf', name: 'Gabriella Montez', short: 'Gabriella', group: 'leads', aliases: ['GABRIELLA'], desc: 'The new student. Very smart and a little shy. She loves to sing but is nervous to try.' },
    { id: 'sharpay', color: '#f2549b', name: 'Sharpay Evans', short: 'Sharpay', group: 'leads', aliases: ['SHARPAY'], desc: 'The star of every school musical. Dramatic and bossy. She does not want anyone to take her spot.' },
    { id: 'ryan', color: '#2b9348', name: 'Ryan Evans', short: 'Ryan', group: 'leads', aliases: ['RYAN'], desc: 'Sharpay’s twin brother. A great singer and dancer who usually follows Sharpay, until he stands up for what is right.' },
    { id: 'chad', color: '#1f6fd6', name: 'Chad Danforth', short: 'Chad', group: 'friends', aliases: ['CHAD'], desc: 'Troy’s best friend on the team. Basketball is his whole world at first.' },
    { id: 'taylor', color: '#e0a800', name: 'Taylor McKessie', short: 'Taylor', group: 'friends', aliases: ['TAYLOR'], desc: 'President of the Science Club. Confident and in charge. She wants Gabriella on the Decathlon team.' },
    { id: 'zeke', color: '#f07f0c', name: 'Zeke Baylor', short: 'Zeke', group: 'friends', aliases: ['ZEKE'], desc: 'A basketball player with a secret: he loves to bake. He has a crush on Sharpay.' },
    { id: 'martha', name: 'Martha Cox', short: 'Martha', group: 'friends', aliases: ['MARTHA', 'MARTHA COX', 'COX'], desc: 'A Brainiac with a secret: she loves to dance hip-hop.' },
    { id: 'kelsi', name: 'Kelsi Nielsen', short: 'Kelsi', group: 'friends', aliases: ['KELSI'], desc: 'The student who wrote the school musical. Quiet, kind, and quick with a comeback for Sharpay.' },
    { id: 'darbus', name: 'Ms. Darbus', short: 'Ms. Darbus', group: 'adults', aliases: ['MS. DARBUS', 'DARBUS'], desc: 'The drama teacher. Big personality, strict rules, and she truly loves theater and her students.' },
    { id: 'coach', name: 'Coach Bolton', short: 'Coach', group: 'adults', aliases: ['COACH BOLTON', 'COACH'], desc: 'The basketball coach and Troy’s dad. He wants Troy to focus on winning.' },
    { id: 'tenny', name: 'Ms. Tenny', short: 'Ms. Tenny', group: 'adults', small: true, aliases: ['MS. TENNY', 'TENNY'], desc: 'The chemistry teacher.' },
    { id: 'moderator', name: 'Moderator', short: 'Moderator', group: 'adults', small: true, aliases: ['MODERATOR'], desc: 'Runs the Science Decathlon. Can be the same actor as Ms. Tenny.' },
    { id: 'jack', name: 'Jack Scott', short: 'Jack Scott', group: 'featured', aliases: ['JACK SCOTT', 'JACK'], desc: 'The school announcer. Nervous until he gets a microphone, then he turns into a cool radio DJ.' },
    { id: 'kratnoff', name: 'Kratnoff', short: 'Kratnoff', group: 'featured', aliases: ['KRATNOFF'], desc: 'A Brainiac who does not like change.' },
    { id: 'drummajor', name: 'Drum Major', short: 'Drum Major', group: 'featured', aliases: ['DRUM MAJOR'], desc: 'Leads the cheer for the Wildcats at the very start of the show.' },
    { id: 'cathy', name: 'Cathy', short: 'Cathy', group: 'featured', aliases: ['CATHY'], desc: 'A Thespian at auditions who belts out her song.' },
    { id: 'cyndra', name: 'Cyndra', short: 'Cyndra', group: 'featured', aliases: ['CYNDRA'], desc: 'A Thespian at auditions who loves opera.' },
    { id: 'james', name: 'James', short: 'James', group: 'featured', aliases: ['JAMES'], desc: 'A Thespian at auditions who sings off-key on purpose. It is a comedy moment.' },
    { id: 'susan', name: 'Susan', short: 'Susan', group: 'featured', aliases: ['SUSAN'], desc: 'A Thespian at auditions who wants to be a pop star.' },
    { id: 'jocks', name: 'Jocks', short: 'Jocks', group: 'ensemble', aliases: ['JOCKS', 'JOCK'], desc: 'The basketball team.' },
    { id: 'cheer', name: 'Cheerleaders', short: 'Cheer', group: 'ensemble', aliases: ['CHEERLEADERS', 'CHEERLEADER'], desc: 'East High’s cheer squad.' },
    { id: 'brainiacs', name: 'Brainiacs', short: 'Brainiacs', group: 'ensemble', aliases: ['BRAINIACS'], desc: 'The smartest students in school, led by Taylor.' },
    { id: 'thespians', name: 'Thespians', short: 'Thespians', group: 'ensemble', aliases: ['THESPIANS'], desc: 'The drama club.' },
    { id: 'partykids', name: 'Party Kids', short: 'Party Kids', group: 'ensemble', aliases: ['PARTY KIDS'], desc: 'Teens at the New Year’s Eve party where Troy and Gabriella meet.' },
    { id: 'rebels', name: 'Rebels', short: 'Rebels', group: 'ensemble', aliases: ['REBELS'], desc: 'Students who break out of their group in “Stick to the Status Quo.”' },
    { id: 'students', name: 'Students', short: 'Students', group: 'ensemble', aliases: ['STUDENTS', 'GROUP'], desc: 'Everyone else at East High.' },
    /* not in the script: Colleen's idea (2026-10-21), peers in the trench for the basketball number */
    { id: 'trench', name: 'Trench Crew', short: 'Trench Crew', group: 'helpers', aliases: [], desc: 'Company Mentors in the trench (the pit) for “Get’cha Head in the Game.” They do the choreography facing the stage so the cast can follow along, and they catch any basketball that bounces off the stage.' }
  ],
  /* how the read-aloud voice should say names it gets wrong (Teacher mode › Script › How words are said adds more) */
  say: { 'Sharpay': 'Shar pay', 'Kelsi': 'Kelsey', 'McKessie': 'Mick Kessie', 'Kratnoff': 'Krat noff', 'Cyndra': 'Sindra', 'Get’cha': 'Getcha', "Get'cha": 'Getcha', 'Darbus': 'Dar bus' },
  /* speaker labels that mean several groups at once */
  labelGroups: { ALL: '*', CLIQUES: ['jocks', 'brainiacs', 'thespians', 'cheer'], 'JOCKS, BRAINIACS': ['jocks', 'brainiacs'] },

  scenes: [
    { id: 's1', num: 1, place: 'East High School', when: 'Monday, 7:45 A.M.', page: 1, icon: 'school',
      story: 'It is the first day back after winter break. The cheerleaders pump everyone up. Then we jump back in time to New Year’s Eve, when Troy and Gabriella meet at a party and sing karaoke together.',
      sensory: ['Loud cheering and a drum at the very start', 'Lights change for the party flashback'] },
    { id: 's2', num: 2, place: 'Homeroom', when: 'Monday, 8 A.M.', page: 8, icon: 'class',
      story: 'Jack Scott does the morning announcements. Ms. Darbus tells everyone about auditions for the school musical. Some students use their phones in class and get detention.',
      sensory: ['Ms. Darbus hits a small gong', 'A phone rings', 'School bell'] },
    { id: 's3', num: 3, place: 'Hallway', when: 'Monday, 8:15 A.M.', page: 10, icon: 'hall',
      story: 'Troy and Gabriella are surprised to find out they go to the same school now. Sharpay notices Gabriella looking at the audition sign-up.',
      sensory: [] },
    { id: 's4', num: 4, place: 'Gym', when: 'Monday, 8:30 A.M.', page: 12, icon: 'ball',
      story: 'Basketball practice. Coach Bolton tells the team to keep their head in the game, but Troy keeps thinking about singing.',
      sensory: ['Basketballs bouncing', 'A coach’s whistle'] },
    { id: 's5', num: 5, place: 'Lab', when: 'Monday, 2 P.M.', page: 19, icon: 'lab',
      story: 'In chemistry class, Gabriella shows how smart she is. Taylor wants her on the Science Decathlon team. Sharpay and Ryan make a plan to keep Gabriella away from auditions.',
      sensory: ['A phone call on stage'] },
    { id: 's6', num: 6, place: 'Theater', when: 'Monday, 3 P.M.', page: 21, icon: 'stage',
      story: 'Detention with Ms. Darbus. Coach Bolton storms in looking for his players and finds them doing acting exercises.',
      sensory: [] },
    { id: 's7', num: 7, place: 'Theater', when: 'Tuesday, 3 P.M.', page: 24, icon: 'mic',
      story: 'Musical auditions. The Thespians try out, then Sharpay and Ryan. Troy and Gabriella arrive too late, but they sing Kelsi’s song with her, and Ms. Darbus hears them. They get a callback.',
      sensory: ['Some auditions are off-key on purpose for laughs', 'School bell'] },
    { id: 's8', num: 8, place: 'Hallway', when: 'Wednesday, 8:15 A.M.', page: 37, icon: 'hall',
      story: 'Sharpay is furious when she sees Troy and Gabriella on the callback list.',
      sensory: [] },
    { id: 's9', num: 9, place: 'Cafeteria', when: 'Wednesday, 12 P.M.', page: 38, icon: 'lunch',
      story: 'Lunch. Students start sharing secret talents (Zeke bakes, Martha dances), and the groups get upset. Everyone thinks people should stick to the way things have always been.',
      sensory: ['Busy and crowded stage', 'Lots of loud voices at once'] },
    { id: 's10', num: 10, place: 'Horticulture Headquarters', when: 'Wednesday, 12:30 P.M.', page: 48, icon: 'plant',
      story: 'Troy and Gabriella escape to a quiet place and talk about how things used to be simpler.',
      sensory: ['Quiet scene'] },
    { id: 's11', num: 11, place: 'Study Hall', when: 'Wednesday, 1 P.M.', page: 49, icon: 'class',
      story: 'The Jocks and Brainiacs plan to get Troy and Gabriella focused on the team and the Decathlon again. Sharpay plans a trick of her own.',
      sensory: [] },
    { id: 's12', num: 12, place: 'Gym', when: 'Wednesday, 3:30 P.M.', page: 50, icon: 'ball',
      story: 'Coach Bolton and Ms. Darbus argue about Troy. Troy is caught in the middle.',
      sensory: [] },
    { id: 's13', num: 13, place: 'Locker Room / Lab', when: 'Wednesday, 4 P.M.', page: 52, icon: 'lab',
      story: 'The team and the Brainiacs remind Troy and Gabriella that people are counting on them. They trick Troy into saying the musical doesn’t matter, and Gabriella hears it.',
      sensory: ['Two places on stage at once'] },
    { id: 's14', num: 14, place: 'Theater', when: 'Thursday, 12:45 P.M.', page: 59, icon: 'stage',
      story: 'Gabriella tells Kelsi she will not do the callback.',
      sensory: [] },
    { id: 's15', num: 15, place: 'Cafeteria', when: 'Thursday, 1 P.M.', page: 60, icon: 'lunch',
      story: 'Troy says sorry, and Gabriella forgives him. Then Jack Scott announces the callback time has changed to the same time as the big game and the Decathlon. The friends feel bad and make a plan to help.',
      sensory: ['Loud group song'] },
    { id: 's16', num: 16, place: 'Lab / Theater / Gym', when: 'Friday, 3 P.M.', page: 67, icon: 'trophy',
      story: 'Three things happen at once: the callbacks, the championship game, and the Decathlon. Taylor turns off the lights so Troy and Gabriella can run to the theater. Ryan tells the truth, and Troy and Gabriella sing their callback.',
      sensory: ['Lights go out (blackout)', 'Loud game buzzer', 'People running on stage'] },
    { id: 's17', num: 17, place: 'Gym', when: 'Friday, 5 P.M.', page: 79, icon: 'party',
      story: 'Both teams win! Everyone celebrates together, and the show ends with bows.',
      sensory: ['Game buzzer', 'Loud cheering and applause', 'Bows at the end'] }
  ],

  // the app's look for this show (Colleen 2026-10-22: "a little more branded to High School Musical"): East High red and white, a varsity
  // lettering font for titles, pennant stripes and a basketball drawn for the app. No Disney logo, show art or movie fonts.
  theme: { id: 'easthigh', color: '#b3121f', presents: 'East High Drama Club presents', cheer: 'Go Wildcats!' },

  // who sings with a group when the script names the group (Colleen 2026-10-23: Chad is a Jock when he has no featured moment, "just Chad"
  // when the script says CHAD; Troy is not one of the Jocks). The teacher changes these on the Cast page.
  groupMembers: { jocks: ['chad', 'zeke'], brainiacs: ['taylor', 'martha'] },

  // the mic plot this show starts from (Colleen 2026-10-22: plan for 10 body mics; Jack Scott and the Moderator use a handheld)
  micPlot: { n: 10, pin: { jack: 'hand', moderator: 'hand' } },

  songs: [
    { id: 'm1', num: '1', title: 'Wildcat Cheer', scene: 's1', page: 1, minutes: 1.5 },
    { id: 'm2', num: '2', title: 'Start of Something New', scene: 's1', page: 3, minutes: 3.5 },
    { id: 'm9', num: '9', title: 'Get’cha Head in the Game', scene: 's4', page: 11, minutes: 4 },
    { id: 'm16', num: '16', title: 'Auditions', scene: 's7', page: 24, minutes: 3 },
    { id: 'm17', num: '17', title: 'What I’ve Been Looking For', scene: 's7', page: 29, minutes: 1.5 },
    { id: 'm19', num: '19', title: 'What I’ve Been Looking For (Reprise)', scene: 's7', page: 33, minutes: 2 },
    { id: 'm21', num: '21', title: 'Stick to the Status Quo', scene: 's9', page: 38, minutes: 5 },
    { id: 'm25', num: '25', title: 'Counting on You', scene: 's13', page: 52, minutes: 3.5 },
    { id: 'm32', num: '32', title: 'We’re All in This Together', scene: 's15', page: 62, minutes: 3.5 },
    { id: 'm33', num: '33', title: 'Bop to the Top', scene: 's16', page: 67, minutes: 3 },
    { id: 'm38', num: '38', title: 'Breaking Free', scene: 's16', page: 75, minutes: 4 },
    { id: 'm40', num: '40', title: 'We’re All in This Together (Reprise)', scene: 's17', page: 81, minutes: 1.5 },
    { id: 'm41', num: '41', title: 'High School Musical Megamix (Bows)', scene: 's17', page: 85, minutes: 5 }
  ],

  /* the show in order, in moments a performer can picture: a stretch of talking, or one song.
     on: who is on stage. '*' means the whole cast. where: { character: where they are, if not on the stage itself }. big: a big group number: everyone in the ensemble and every small role joins
     (Colleen: as much stage time as possible; large group numbers include everyone, barring costume changes). out: taken off by the teacher. */
  moments: [
    { id: 'k1', scene: 's1', song: 'm1', on: '*' },
    { id: 'k2', scene: 's1', minutes: 1, on: ['troy', 'chad', 'zeke', 'jocks', 'gabriella', 'taylor', 'sharpay', 'ryan', 'students'] },
    { id: 'k3', scene: 's1', song: 'm2', big: true, on: ['troy', 'gabriella', 'partykids'] },
    { id: 'k4', scene: 's1', minutes: 3, on: ['troy', 'gabriella', 'chad', 'partykids'] },
    { id: 'k5', scene: 's2', minutes: 2.5, on: ['darbus', 'jack', 'troy', 'gabriella', 'chad', 'taylor', 'sharpay', 'ryan', 'kelsi', 'jocks', 'students'] },
    { id: 'k6', scene: 's3', minutes: 2, on: ['troy', 'gabriella', 'sharpay'] },
    { id: 'k7', scene: 's4', song: 'm9', big: true, on: ['coach', 'troy', 'chad', 'zeke', 'jocks', 'trench'], where: { trench: 'In the trench (the pit), facing the stage: do the moves big so the cast can follow, and catch any basketball that bounces off' } },
    { id: 'k8', scene: 's4', minutes: 2, on: ['coach', 'troy', 'chad', 'zeke', 'jocks'] },
    { id: 'k9', scene: 's5', minutes: 2.5, on: ['tenny', 'gabriella', 'taylor', 'martha', 'kratnoff', 'brainiacs', 'sharpay', 'ryan', 'jack', 'students'] },
    { id: 'k10', scene: 's6', minutes: 3, on: ['darbus', 'coach', 'troy', 'gabriella', 'chad', 'taylor', 'sharpay', 'students'] },
    { id: 'k11', scene: 's7', song: 'm16', big: true, on: ['darbus', 'kelsi', 'thespians', 'cathy', 'cyndra', 'james', 'susan', 'sharpay', 'ryan'] },
    { id: 'k12', scene: 's7', minutes: 1, on: ['darbus', 'kelsi', 'sharpay', 'ryan', 'thespians'] },
    { id: 'k13', scene: 's7', song: 'm17', on: ['sharpay', 'ryan', 'kelsi', 'darbus'] },
    { id: 'k14', scene: 's7', minutes: 2.5, on: ['sharpay', 'ryan', 'kelsi', 'gabriella', 'troy', 'darbus'] },
    { id: 'k15', scene: 's7', song: 'm19', on: ['troy', 'gabriella', 'kelsi', 'darbus'] },
    { id: 'k16', scene: 's7', minutes: 1.5, on: ['troy', 'gabriella', 'kelsi', 'darbus'] },
    { id: 'k17', scene: 's8', minutes: 1, on: ['sharpay', 'ryan'] },
    { id: 'k18', scene: 's9', song: 'm21', big: true, on: ['zeke', 'martha', 'kratnoff', 'chad', 'taylor', 'kelsi', 'sharpay', 'ryan', 'troy', 'gabriella', 'jocks', 'brainiacs', 'thespians', 'cheer', 'rebels', 'students'] },
    { id: 'k19', scene: 's9', minutes: 3, on: ['zeke', 'martha', 'kratnoff', 'chad', 'taylor', 'kelsi', 'sharpay', 'ryan', 'troy', 'gabriella', 'jocks', 'brainiacs', 'thespians', 'cheer', 'rebels', 'students'] },
    { id: 'k20', scene: 's10', minutes: 1.5, on: ['troy', 'gabriella'] },
    { id: 'k21', scene: 's11', minutes: 1.5, on: ['taylor', 'chad', 'sharpay', 'ryan', 'jocks', 'brainiacs'] },
    { id: 'k22', scene: 's12', minutes: 2, on: ['coach', 'darbus', 'troy', 'jocks'] },
    { id: 'k23', scene: 's13', song: 'm25', big: true, on: ['chad', 'taylor', 'zeke', 'martha', 'kratnoff', 'troy', 'gabriella', 'jocks', 'brainiacs'] },
    { id: 'k24', scene: 's13', minutes: 4, on: ['chad', 'taylor', 'zeke', 'martha', 'kratnoff', 'troy', 'gabriella', 'jocks', 'brainiacs'] },
    { id: 'k25', scene: 's14', minutes: 1.5, on: ['gabriella', 'troy', 'kelsi'] },
    { id: 'k26', scene: 's15', minutes: 2.5, on: ['troy', 'gabriella', 'chad', 'taylor', 'kelsi', 'jack', 'sharpay', 'ryan', 'zeke', 'martha', 'jocks', 'brainiacs', 'students'] },
    { id: 'k27', scene: 's15', song: 'm32', big: true, on: ['chad', 'taylor', 'zeke', 'kelsi', 'martha', 'kratnoff', 'jocks', 'brainiacs', 'students'] },
    { id: 'k28', scene: 's15', minutes: 1, on: ['chad', 'taylor', 'zeke', 'kelsi', 'martha', 'jocks', 'brainiacs'] },
    { id: 'k29', scene: 's16', song: 'm33', big: true, on: ['sharpay', 'ryan', 'kelsi', 'darbus', 'troy', 'coach', 'chad', 'zeke', 'jocks', 'cheer', 'gabriella', 'taylor', 'martha', 'kratnoff', 'moderator', 'brainiacs', 'jack'] },
    { id: 'k30', scene: 's16', minutes: 6, on: ['moderator', 'taylor', 'gabriella', 'brainiacs', 'martha', 'kratnoff', 'jack', 'coach', 'troy', 'chad', 'zeke', 'jocks', 'cheer', 'sharpay', 'ryan', 'darbus', 'kelsi', 'students'] },
    { id: 'k31', scene: 's16', song: 'm38', big: true, on: ['troy', 'gabriella', 'kelsi', 'darbus', 'sharpay', 'ryan', 'chad', 'taylor', 'zeke', 'martha', 'jocks', 'brainiacs', 'thespians', 'cheer', 'students'] },
    { id: 'k32', scene: 's16', minutes: 1, on: ['troy', 'gabriella', 'coach', 'darbus', 'jocks', 'brainiacs', 'moderator'] },
    { id: 'k33', scene: 's17', minutes: 2.5, on: '*' },
    { id: 'k34', scene: 's17', song: 'm40', on: '*' },
    { id: 'k35', scene: 's17', song: 'm41', on: '*' }
  ],

  /* props to start from (our own list; Teacher mode › Production › Shopping changes it) */
  props: [
    { id: 'p-balls', name: 'Basketballs', who: 'jocks', qty: 6, scenes: ['s4', 's16'] },
    { id: 'p-whistle', name: 'Whistle on a lanyard', who: 'coach', qty: 1, scenes: ['s4', 's12'] },
    { id: 'p-clipboard', name: 'Clipboard', who: 'coach', qty: 1, scenes: ['s4', 's16'] },
    { id: 'p-poms', name: 'Pom-poms', who: 'cheer', qty: 8, scenes: ['s1', 's16'] },
    { id: 'p-gong', name: 'Small gong or bell', who: 'darbus', qty: 1, scenes: ['s2'] },
    { id: 'p-phones', name: 'Old cell phones (pretend)', who: 'students', qty: 4, scenes: ['s2', 's5'] },
    { id: 'p-mic', name: 'Karaoke microphone', who: 'partykids', qty: 2, scenes: ['s1'] },
    { id: 'p-music', name: 'Binder of sheet music', who: 'kelsi', qty: 1, scenes: ['s7'] },
    { id: 'p-treats', name: 'Tray of baked treats (fake)', who: 'zeke', qty: 1, scenes: ['s9'] },
    { id: 'p-trays', name: 'Cafeteria lunch trays', who: 'students', qty: 10, scenes: ['s9', 's15'] },
    { id: 'p-backpacks', name: 'Backpacks', who: 'students', qty: 8, scenes: ['s2', 's3'] },
    { id: 'p-books', name: 'Textbooks and notebooks', who: 'brainiacs', qty: 8, scenes: ['s5', 's16'] },
    { id: 'p-buzzer', name: 'Game buzzer or bell', who: 'moderator', qty: 1, scenes: ['s16'] },
    { id: 'p-trophy', name: 'Trophy', who: 'coach', qty: 1, scenes: ['s17'] },
    { id: 'p-hats', name: 'Party hats and noisemakers', who: 'partykids', qty: 10, scenes: ['s1'] },
    { id: 'p-headset', name: 'Announcer microphone or headset', who: 'jack', qty: 1, scenes: ['s2', 's15', 's16'] }
  ],

  /* the school-day (45-minute) version: Colleen's ranked cut options, best first. Each is a whole moment; text changes inside a scene need MTI's OK. */
  cutIdeas: [
    { moments: ['k20'], name: 'Scene 10: Horticulture Headquarters (rooftop garden)', saves: 'about 2 min with its scene change',
      why: 'Fewest people (Troy and Gabriella only), no plot hole: the callback decision comes back stronger in Scene 14. Also saves building the garden set and one scene change. You lose their quiet scene and the first “kindergarten” mention that later lines call back to.' },
    { moments: ['k17'], name: 'Scene 8: Hallway (Sharpay and Ryan see the callback list)', saves: 'about 45 seconds',
      why: 'The cafeteria opens with everyone buzzing about the news, so the audience still gets it. Without it, “Stick to the Status Quo” starts cold.' }
  ],
  cutNotes: [
    'Try first: tighten scene changes. In school shows most extra time is in transitions: rehearse changes like scenes, have actors carry their own furniture, play short scenes (3, 8, 10) downstage in front of a traveler while the next set goes up, and use Jack’s announcer corner to cover.',
    'Small trim: Jack Scott’s announcement at the end of Scene 2 (20–30 seconds) only repeats the audition reminder; cut it only if the homeroom-to-hallway change gets faster.'
  ],

  /* costume ideas to start from; Teacher mode is where they become the real plot */
  costumes: [
    { id: 'c-troy-school', who: 'troy', name: 'School clothes', items: ['Hoodie or T-shirt', 'Jeans', 'Sneakers'], moments: ['k2', 'k5', 'k6', 'k10', 'k14', 'k15', 'k16', 'k18', 'k19', 'k20', 'k25', 'k26'] },
    { id: 'c-troy-party', who: 'troy', name: 'New Year’s party outfit', items: ['Button-up shirt', 'Party hat'], moments: ['k3', 'k4'] },
    { id: 'c-troy-practice', who: 'troy', name: 'Basketball practice clothes', items: ['Practice jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k7', 'k8', 'k22', 'k23', 'k24'] },
    { id: 'c-troy-game', who: 'troy', name: 'Game jersey', items: ['Team jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k29', 'k30', 'k31', 'k32', 'k33', 'k34', 'k35'] },
    { id: 'c-gabriella-school', who: 'gabriella', name: 'School clothes', items: ['Top and cardigan', 'Skirt or jeans', 'Flats'], moments: ['k2', 'k5', 'k6', 'k9', 'k10', 'k14', 'k15', 'k16', 'k18', 'k19', 'k20', 'k23', 'k24', 'k25', 'k26'] },
    { id: 'c-gabriella-party', who: 'gabriella', name: 'New Year’s party dress', items: ['Party dress', 'Party hat'], moments: ['k3', 'k4'] },
    { id: 'c-gabriella-decathlon', who: 'gabriella', name: 'Decathlon outfit', items: ['Lab coat', 'Name badge'], moments: ['k29', 'k30', 'k31', 'k32', 'k33', 'k34', 'k35'] },
    { id: 'c-jocks-school', who: 'jocks', name: 'School clothes', items: ['Team T-shirt', 'Jeans', 'Sneakers'], moments: ['k2', 'k5', 'k11', 'k18', 'k19', 'k21', 'k26', 'k27', 'k28'] },
    { id: 'c-jocks-practice', who: 'jocks', name: 'Basketball practice clothes', items: ['Practice jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k7', 'k8', 'k22', 'k23', 'k24'] },
    { id: 'c-jocks-game', who: 'jocks', name: 'Game jersey', items: ['Team jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k1', 'k29', 'k30', 'k31', 'k32', 'k33', 'k34', 'k35'] },
    { id: 'c-chad-school', who: 'chad', name: 'School clothes', items: ['Team T-shirt', 'Jeans', 'Sneakers'], moments: ['k2', 'k4', 'k5', 'k10', 'k18', 'k19', 'k21', 'k26', 'k27', 'k28'] },
    { id: 'c-chad-practice', who: 'chad', name: 'Basketball practice clothes', items: ['Practice jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k7', 'k8', 'k23', 'k24'] },
    { id: 'c-chad-game', who: 'chad', name: 'Game jersey', items: ['Team jersey', 'Gym shorts', 'Basketball sneakers'], moments: ['k1', 'k29', 'k30', 'k31', 'k33', 'k34', 'k35'] },
    { id: 'c-cheer', who: 'cheer', name: 'Cheer uniform', items: ['Cheer top', 'Cheer skirt', 'Pom-poms'], moments: ['k1', 'k29', 'k30', 'k31', 'k33', 'k34', 'k35'] },
    { id: 'c-cheer-school', who: 'cheer', name: 'School clothes', items: ['Top', 'Jeans', 'Sneakers'], moments: ['k18', 'k19'] },
    { id: 'c-brainiacs-lab', who: 'brainiacs', name: 'Lab coat', items: ['Lab coat', 'Safety goggles'], moments: ['k9', 'k23', 'k24', 'k29', 'k30', 'k31', 'k32'] },
    { id: 'c-brainiacs-school', who: 'brainiacs', name: 'School clothes', items: ['Sweater vest or cardigan', 'Pants or skirt'], moments: ['k1', 'k18', 'k19', 'k21', 'k26', 'k27', 'k28', 'k33', 'k34', 'k35'] },
    { id: 'c-sharpay-school', who: 'sharpay', name: 'School outfit', items: ['Pink top', 'Skirt', 'Sparkly shoes'], moments: ['k1', 'k2', 'k5', 'k6', 'k9', 'k10', 'k11', 'k12', 'k13', 'k14', 'k17', 'k18', 'k19', 'k21', 'k26'] },
    { id: 'c-sharpay-callback', who: 'sharpay', name: 'Callback costume', items: ['Sparkly performance outfit'], moments: ['k29', 'k30', 'k31', 'k33', 'k34', 'k35'] },
    { id: 'c-ryan-school', who: 'ryan', name: 'School outfit', items: ['Bright shirt', 'Hat', 'Vest'], moments: ['k1', 'k2', 'k5', 'k9', 'k11', 'k12', 'k13', 'k14', 'k17', 'k18', 'k19', 'k21', 'k26'] },
    { id: 'c-ryan-callback', who: 'ryan', name: 'Callback costume', items: ['Sparkly performance outfit', 'Hat'], moments: ['k29', 'k30', 'k31', 'k33', 'k34', 'k35'] },
    { id: 'c-partykids', who: 'partykids', name: 'New Year’s party outfit', items: ['Party clothes', 'Party hat'], moments: ['k3', 'k4'] },
    { id: 'c-trench', who: 'trench', name: 'Trench Crew warm-ups', items: ['Wildcats T-shirt', 'Track pants', 'Sneakers', 'Sweatband'], moments: ['k7'] }
  ]
};
