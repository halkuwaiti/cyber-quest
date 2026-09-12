// ============================================================================
// questions.js — Cyber Quest question bank, 3 difficulty tiers
// ----------------------------------------------------------------------------
// 45 total questions. Each threat domain has 9: 3 Beginner + 3 Intermediate +
// 3 Advanced. Each question block in a level is keyed by (layer, index). The
// current difficulty is tracked on game state and passed through on lookup.
//
// BEGINNER     → vocabulary and "what is X" — safe for younger kids (8-10).
// INTERMEDIATE → real-world scenarios — highest demo value, ages 10-13.
// ADVANCED     → nuanced threats and defenses — older kids / parents.
// ============================================================================

(function () {
  const PQ = window.PQ = window.PQ || {};

  const LAYERS = {
    PHISHING:   { label: 'Phishing Lake',     short: 'PHISHING'   },
    PASSWORD:   { label: 'Password Castle',   short: 'PASSWORD'   },
    MALWARE:    { label: 'Malware Forest',    short: 'MALWARE'    },
    PRIVACY:    { label: 'Privacy Plaza',     short: 'PRIVACY'    },
    RANSOMWARE: { label: 'Ransomware Vault',  short: 'RANSOMWARE' }
  };
  PQ.LAYERS = LAYERS;

  const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  PQ.DIFFICULTIES = DIFFICULTIES;

  // ==========================================================================
  // BEGINNER — vocabulary and "what is X"
  // ==========================================================================
  const BEGINNER = {
    PHISHING: [
      {
        id: 'B-PH-1', layer: 'PHISHING', topic: 'Free stuff trap',
        q: 'You get an email: "Click here for FREE 1000 V-Bucks!" — what do you do?',
        a: [
          'Click immediately — free V-Bucks!',
          'Forward it to your friends so they can get free V-Bucks too',
          'Don\'t click. Real games never give free stuff through random emails',
          'Reply asking for 2000 instead'
        ],
        correct: 2,
        why: 'There is no real "free V-Bucks" link. Every single one is a scam designed to steal your account or install malware.'
      },
      {
        id: 'B-PH-2', layer: 'PHISHING', topic: 'You won! popup',
        q: 'A pop-up appears: "🎉 YOU\'VE WON! Click here to claim your prize!" What is this?',
        a: [
          'A real prize — you should claim it before someone else does',
          'A fake — you didn\'t enter any contest, so you can\'t have won',
          'A bug in your browser',
          'A friendly message from your computer'
        ],
        correct: 1,
        why: 'You can\'t win a contest you never entered. "You won!" pop-ups are one of the oldest scams — they always lead to trouble.'
      },
      {
        id: 'B-PH-3', layer: 'PHISHING', topic: 'Weird link from friend',
        q: 'A friend DMs you: "look at this funny pic" with a link you don\'t recognize. The link looks weird. You should:',
        a: [
          'Click — it\'s your friend',
          'First message your friend a different way to ask if they really sent it. Their account might be hacked',
          'Reply with your own funny pic',
          'Forward the link to everyone else'
        ],
        correct: 1,
        why: 'When a friend sends a weird link out of nowhere, their account may be hacked and the message is from the hacker. Confirm before clicking.'
      }
    ],
    PASSWORD: [
      {
        id: 'B-PW-1', layer: 'PASSWORD', topic: 'Friend asks for password',
        q: 'Your best friend asks: "What\'s your game password? I want to play on your account." You should:',
        a: [
          'Tell them — they\'re your best friend',
          'Tell them only the first half',
          'Say no. Even with friends, password sharing is how accounts get banned or hijacked',
          'Change it to "12345" first then share that'
        ],
        correct: 2,
        why: 'Real friends understand a "no" here. If they do something against the rules on your account, your account gets banned.'
      },
      {
        id: 'B-PW-2', layer: 'PASSWORD', topic: 'Same password everywhere',
        q: 'You use the same password on Roblox, Snapchat, and Gmail. Why is this risky?',
        a: [
          'It uses up your computer\'s memory',
          'If any one site gets hacked, all three accounts get hacked at once',
          'Your password gets weaker over time',
          'It\'s not risky — it\'s easier to remember'
        ],
        correct: 1,
        why: 'When a site gets hacked, the leaked passwords get tried on every other popular site. Use a different password for each account.'
      },
      {
        id: 'B-PW-3', layer: 'PASSWORD', topic: 'Easy password',
        q: 'Which of these is the WEAKEST password?',
        a: [
          'B!ueDr4gon-Sw!ms',
          'mySchoolName2014',
          '123456',
          'P@$$w0rd_X9!'
        ],
        correct: 2,
        why: '"123456" is one of the most-guessed passwords ever. Hackers try it first. Long passwords with mixed characters are much safer.'
      }
    ],
    MALWARE: [
      {
        id: 'B-MW-1', layer: 'MALWARE', topic: 'Free Robux generator',
        q: 'You see "FREE 10000 ROBUX! Just download this app." Should you?',
        a: [
          'Yes — 10000 Robux is a lot',
          'No. There is no real free-Robux app — every single one is malware',
          'Only if your antivirus is on',
          'Yes, but use a fake name'
        ],
        correct: 1,
        why: 'There is no real "Robux generator." Every single one steals your account, installs malware, or both.'
      },
      {
        id: 'B-MW-2', layer: 'MALWARE', topic: 'Fake virus alert',
        q: 'A scary pop-up says "WARNING! Your computer has 9 viruses! Click here to fix!" What do you do?',
        a: [
          'Click immediately to remove the viruses',
          'Don\'t click. Real antivirus programs don\'t show scary pop-ups in your browser — this IS the virus',
          'Restart the computer 3 times',
          'Pay the popup to fix it'
        ],
        correct: 1,
        why: 'Fake virus alerts in your browser are the scam. Clicking them is what installs the real malware.'
      },
      {
        id: 'B-MW-3', layer: 'MALWARE', topic: 'Mystery USB',
        q: 'You find a USB stick on the school floor labeled "PRIVATE — open me." You should:',
        a: [
          'Plug it into your computer to find the owner',
          'Plug it into a school computer instead',
          'Give it to a teacher and never plug it in. USB sticks can install malware automatically',
          'Open it on your phone'
        ],
        correct: 2,
        why: 'Dropping infected USBs is a real attack. Just plugging one in can infect your device. Always hand it to an adult.'
      }
    ],
    PRIVACY: [
      {
        id: 'B-PV-1', layer: 'PRIVACY', topic: 'Stranger asks for address',
        q: 'A new online friend asks: "Where do you live?" What do you do?',
        a: [
          'Send your full home address — they\'re a friend',
          'Send your city only',
          'Don\'t share. Strangers should never know where to find you in real life',
          'Send your school address instead'
        ],
        correct: 2,
        why: 'Even just chatting for weeks doesn\'t make someone safe. Never tell online strangers where you live, go to school, or hang out.'
      },
      {
        id: 'B-PV-2', layer: 'PRIVACY', topic: 'Selfie in uniform',
        q: 'You want to post a selfie online while wearing your school uniform. What\'s the risk?',
        a: [
          'Uniforms aren\'t fashionable',
          'The uniform shows your school. Strangers can find you there every weekday',
          'No risk',
          'Photos of uniforms aren\'t allowed by the school'
        ],
        correct: 1,
        why: 'A uniform photo + your face + posting time = a stranger knowing where to find you. Crop or cover the school logo.'
      },
      {
        id: 'B-PV-3', layer: 'PRIVACY', topic: 'Game wants phone number',
        q: 'A new game asks for your real phone number to "create your profile." What\'s the right move?',
        a: [
          'Give it — the game needs it',
          'Don\'t give it. Real games don\'t need your phone number — this is a privacy red flag',
          'Give a fake number',
          'Give your parents\' number'
        ],
        correct: 1,
        why: 'Apps that demand too much info are collecting it to sell or misuse. Real games don\'t need your phone number to play.'
      }
    ],
    RANSOMWARE: [
      {
        id: 'B-RW-1', layer: 'RANSOMWARE', topic: 'Locked screen',
        q: 'Your screen turns red and says "All files locked! Pay $50 to unlock." What\'s the right thing to do?',
        a: [
          'Pay $50 — it\'s cheap',
          'Tell a parent or teacher right away. Never pay — disconnect from the internet',
          'Try every password you know',
          'Throw the computer away'
        ],
        correct: 1,
        why: 'Always tell a trusted adult. Never pay — paying doesn\'t guarantee getting files back, and it funds the next attack.'
      },
      {
        id: 'B-RW-2', layer: 'RANSOMWARE', topic: 'Scary attachment',
        q: 'You get an email with a file called "homework.exe" from someone you don\'t know. Should you open it?',
        a: [
          'Yes — it might be your homework',
          'No. ".exe" files from strangers are how ransomware gets in. Delete the email',
          'Save it for later',
          'Forward it to your friend'
        ],
        correct: 1,
        why: '".exe" is a program that runs code. From a stranger, in an unexpected email = ransomware delivery 9 times out of 10.'
      },
      {
        id: 'B-RW-3', layer: 'RANSOMWARE', topic: 'Backups',
        q: 'Why do experts say backups are the best protection against ransomware?',
        a: [
          'Backups make computers faster',
          'If your live files get locked, you can restore the backup and laugh at the attackers',
          'Backups make ransomware go away on their own',
          'Backups are required by law'
        ],
        correct: 1,
        why: 'Ransomware loses its power when you have backups. You restore your files in minutes, the attackers get nothing.'
      }
    ]
  };

  // ==========================================================================
  // INTERMEDIATE — real-world scenarios (highest demo value)
  // ==========================================================================
  const INTERMEDIATE = {
    PHISHING: [
      {
        id: 'I-PH-1', layer: 'PHISHING', topic: 'Urgency scam',
        q: 'You get an email: "URGENT: Your Roblox account will be deleted in 24 hours unless you click here." What should you do?',
        a: [
          'Click immediately — you do not want to lose your account',
          'Forward to all your friends so they can help',
          'Ignore the link, open Roblox the normal way to check, and delete the email',
          'Reply asking for more details'
        ],
        correct: 2,
        why: 'Companies do not delete accounts in 24 hours. Urgency is the #1 phishing tactic. Always log in the normal way to check.'
      },
      {
        id: 'I-PH-2', layer: 'PHISHING', topic: 'Fake sender',
        q: 'An email is from "amaz0n-support@gmail.com". Is this from Amazon?',
        a: [
          'Yes — it says "amazon" right there',
          'Yes — Amazon uses many email addresses',
          'No — Amazon would never send from a Gmail address, and "amaz0n" has a zero instead of an "o"',
          'Maybe — you should reply and ask'
        ],
        correct: 2,
        why: 'Real companies email from their own domain (@amazon.com). Look-alike domains (amaz0n with a zero) are classic phishing.'
      },
      {
        id: 'I-PH-3', layer: 'PHISHING', topic: 'Link mismatch',
        q: 'A link in an email shows "www.bank.com" but when you hover over it, the bottom of your screen shows "evil-site.ru". What is happening?',
        a: [
          'Banks use multiple websites',
          'The visible text is fake — the real link goes to a scam site',
          'Your browser is broken',
          'Russian banks have different addresses'
        ],
        correct: 1,
        why: 'The text you see and where a link goes are different things. Always check where a link actually points before clicking.'
      }
    ],
    PASSWORD: [
      {
        id: 'I-PW-1', layer: 'PASSWORD', topic: 'Friend asks',
        q: 'Your friend says: "Send me your Roblox password so I can log in and send you free Robux." You should:',
        a: [
          'Send it — they are your friend',
          'Send it but change it later',
          'Never send it. No real friend or game gives "free" Robux for your password — this is a scam',
          'Send only the first 3 letters'
        ],
        correct: 2,
        why: 'Real friends never ask for passwords. "Free Robux for your password" is one of the most common scams targeting kids.'
      },
      {
        id: 'I-PW-2', layer: 'PASSWORD', topic: 'Strength check',
        q: 'Which of these is the strongest password?',
        a: [
          'Password123',
          'YourName2014',
          'B!ueDr4gon-Sw!ms-At-Midn1ght',
          '123456789'
        ],
        correct: 2,
        why: 'Length matters most. A long passphrase with mixed types beats short complex ones — and it is easier to remember.'
      },
      {
        id: 'I-PW-3', layer: 'PASSWORD', topic: 'Leaked password',
        q: 'You hear a website you used got hacked and passwords were leaked. You used the same password on Gmail. What do you do?',
        a: [
          'Nothing — they only leaked one site',
          'Change your Gmail password right away, plus any other site where you reused that password',
          'Wait a month to see if anything happens',
          'Email Google to apologize'
        ],
        correct: 1,
        why: 'Hackers try leaked passwords on every popular site. Change reused passwords everywhere immediately.'
      }
    ],
    MALWARE: [
      {
        id: 'I-MW-1', layer: 'MALWARE', topic: 'Free Robux site',
        q: 'A YouTube video says "Click this link for FREE 10000 ROBUX!" The link goes to a strange website asking you to download a program. You should:',
        a: [
          'Download it — you really want the Robux',
          'Never download it. "Free Robux" downloads are almost always malware',
          'Download it but disable your antivirus first',
          'Ask the YouTuber for a different link'
        ],
        correct: 1,
        why: 'There is no real "free Robux generator." Every single one is malware, a scam, or both.'
      },
      {
        id: 'I-MW-2', layer: 'MALWARE', topic: 'Fake popup',
        q: 'A scary popup appears: "WARNING! Your computer is infected with 47 viruses! Click here to fix!" What is this?',
        a: [
          'A real warning from your computer',
          'A fake antivirus scam — clicking installs the actual malware',
          'A safety message from Microsoft',
          'Your antivirus working correctly'
        ],
        correct: 1,
        why: 'Real antivirus programs do not show scary full-screen popups in your browser. These fake alerts are themselves malware delivery systems.'
      },
      {
        id: 'I-MW-3', layer: 'MALWARE', topic: 'USB drive',
        q: 'You find a USB stick on the floor at school with "PRIVATE — open me" written on it. You should:',
        a: [
          'Plug it into your computer to find the owner',
          'Plug it into a school computer instead',
          'Never plug it in — give it to a teacher. USB sticks can install malware automatically',
          'Open it on your phone'
        ],
        correct: 2,
        why: 'Dropped USBs are a common attack — plug it in and it can infect your device instantly. Hand it to an adult.'
      }
    ],
    PRIVACY: [
      {
        id: 'I-PV-1', layer: 'PRIVACY', topic: 'Game asks for info',
        q: 'A new game asks for your full real name, home address, and parents\' phone number to "create your character." Should you give it?',
        a: [
          'Yes — games need this to work',
          'No — games never need your home address. This is a privacy red flag',
          'Yes, but use a fake name',
          'Only if the game is free'
        ],
        correct: 1,
        why: 'Real games never need your address or parents\' phone for a character. Apps that ask for too much info are collecting it to sell or misuse.'
      },
      {
        id: 'I-PV-2', layer: 'PRIVACY', topic: 'New friend',
        q: 'A new online friend asks for a selfie and the name of your school within the first week. What is happening?',
        a: [
          'They are just being friendly',
          'They are interested in your education',
          'This is a major warning sign — strangers should never need your school name or photos',
          'They want to send you a gift'
        ],
        correct: 2,
        why: 'No real online friend needs your school name + photo this fast. This is how predators identify and locate kids.'
      },
      {
        id: 'I-PV-3', layer: 'PRIVACY', topic: 'School uniform',
        q: 'You want to post a fun selfie online while wearing your school uniform. What is the risk?',
        a: [
          'Uniforms are not stylish',
          'The uniform reveals your school — strangers can find where you are every weekday',
          'Uniforms photograph badly',
          'No risk — uniforms are public'
        ],
        correct: 1,
        why: 'A photo with your school logo, plus your face, plus a posting time = a stranger knowing where to find you. Crop or cover the logo.'
      }
    ],
    RANSOMWARE: [
      {
        id: 'I-RW-1', layer: 'RANSOMWARE', topic: 'Locked screen',
        q: 'Your screen suddenly says: "All your files are locked. Send $500 in Bitcoin or lose them forever." What do you do?',
        a: [
          'Pay immediately',
          'Tell a parent or teacher right away — never pay, and disconnect from the internet',
          'Reply asking for a discount',
          'Restart the computer and hope it goes away'
        ],
        correct: 1,
        why: 'Always tell a trusted adult. Disconnect to stop the spread. Never pay — paying does not guarantee getting files back.'
      },
      {
        id: 'I-RW-2', layer: 'RANSOMWARE', topic: 'Bad attachment',
        q: 'You get an email with a file called "invoice.exe" from someone you do not know. What do you do?',
        a: [
          'Open it — it might be important',
          'Forward it to your friend to look at',
          'Never open it. ".exe" files from strangers are how ransomware gets in. Delete the email',
          'Save it for later'
        ],
        correct: 2,
        why: '.exe files are programs. From a stranger, in an email about an "invoice" you did not expect = textbook ransomware delivery.'
      },
      {
        id: 'I-RW-3', layer: 'RANSOMWARE', topic: 'School lockup',
        q: 'You come back from break and the school computer says all student files are locked and demands $5000. Best response:',
        a: [
          'Pay with the school credit card to unlock everything',
          'Tell the teacher and IT immediately — schools have backups, never pay',
          'Try every password you can think of to unlock it',
          'Just delete the files'
        ],
        correct: 1,
        why: 'Schools should restore from backups, not pay. Telling adults fast helps stop the attack from spreading to other computers.'
      }
    ]
  };

  // ==========================================================================
  // ADVANCED — nuanced threats, defenses, deeper concepts
  // ==========================================================================
  const ADVANCED = {
    PHISHING: [
      {
        id: 'A-PH-1', layer: 'PHISHING', topic: 'Spear phishing',
        q: 'What is "spear phishing"?',
        a: [
          'A phishing attack from underwater',
          'A targeted phishing message that uses your real name, school, or interests to seem legit',
          'Sending phishing to many people at once',
          'A phishing tool used by spies'
        ],
        correct: 1,
        why: 'Spear phishing is personalized — uses your name and details — making it much more convincing than generic phishing.'
      },
      {
        id: 'A-PH-2', layer: 'PHISHING', topic: 'Lookalike domain',
        q: 'Why might "paypa1.com" (with the number 1) trick someone into thinking it is "paypal.com"?',
        a: [
          'Computers cannot tell numbers from letters',
          'In some fonts, the digit "1" looks almost identical to a lowercase "l", so the eye reads it as paypal',
          'PayPal owns both addresses',
          'Browsers automatically correct it'
        ],
        correct: 1,
        why: 'Visual lookalikes (1 vs l, 0 vs O) are a classic phishing trick. Always type the real address yourself.'
      },
      {
        id: 'A-PH-3', layer: 'PHISHING', topic: 'Smishing',
        q: '"Smishing" is:',
        a: [
          'Smashing your phone',
          'Phishing through SMS / text messages',
          'A new social media app',
          'A smiling emoji used in scams'
        ],
        correct: 1,
        why: 'Smishing = SMS + phishing. Fake delivery texts, fake bank alerts, fake "your package is delayed" — all by text.'
      }
    ],
    PASSWORD: [
      {
        id: 'A-PW-1', layer: 'PASSWORD', topic: '2FA',
        q: 'What is "two-factor authentication" (2FA)?',
        a: [
          'Using two passwords at once',
          'A second check after your password — usually a code sent to your phone or app',
          'Logging in twice in a row',
          'Sharing your password with two people for backup'
        ],
        correct: 1,
        why: '2FA means even if your password leaks, the attacker still cannot get in without your second factor (phone, app, key).'
      },
      {
        id: 'A-PW-2', layer: 'PASSWORD', topic: 'Length',
        q: 'For a password to resist modern attacks, how long should it be (at minimum)?',
        a: [
          '4 characters',
          '6 characters',
          '12 or more characters',
          '8 characters with one symbol'
        ],
        correct: 2,
        why: 'Modern attackers can guess billions of passwords per second. 12+ characters with mixed types is the practical floor.'
      },
      {
        id: 'A-PW-3', layer: 'PASSWORD', topic: 'Passphrase',
        q: 'A "passphrase" is:',
        a: [
          'A secret sentence the website asks you to remember',
          'Several random words used together as a long password — like "purple-banana-window-runner"',
          'A password used on phones',
          'Another name for a security question'
        ],
        correct: 1,
        why: 'Passphrases use length to win. Four random words ("battery-horse-staple-correct") are stronger than a short complex password.'
      }
    ],
    MALWARE: [
      {
        id: 'A-MW-1', layer: 'MALWARE', topic: 'Trojan',
        q: 'A "Trojan" malware is:',
        a: [
          'A virus that erases files instantly',
          'Malware disguised as something useful — a free game, a "free crack", a fun app — that secretly does harm',
          'Malware that only affects iPhones',
          'A Greek style of programming'
        ],
        correct: 1,
        why: 'Trojans hide inside something the user wants. Once installed, they let attackers steal data or control the device.'
      },
      {
        id: 'A-MW-2', layer: 'MALWARE', topic: 'Drive-by',
        q: 'A "drive-by download" happens when:',
        a: [
          'Someone delivers a USB to your house',
          'You get malware just by visiting a malicious or hacked website — no clicks needed',
          'Your antivirus runs in the background',
          'You drive past a Wi-Fi hotspot'
        ],
        correct: 1,
        why: 'Drive-by downloads exploit browser bugs. Keeping your browser and OS updated is the main defense.'
      },
      {
        id: 'A-MW-3', layer: 'MALWARE', topic: 'Updates',
        q: 'Why is updating your phone, computer, and browser one of the most important defenses?',
        a: [
          'Updates make devices look prettier',
          'Updates often patch security holes that malware uses to break in',
          'Updates use less battery',
          'Updates are required by law'
        ],
        correct: 1,
        why: 'Most malware exploits known bugs. Once Apple or Google patches them, only un-updated devices are still vulnerable.'
      }
    ],
    PRIVACY: [
      {
        id: 'A-PV-1', layer: 'PRIVACY', topic: 'Social engineering',
        q: '"Social engineering" is:',
        a: [
          'Designing better social media apps',
          'Tricking people (instead of computers) — using emotion, urgency, or trust to get info or access',
          'A type of school subject',
          'Engineering done by a group'
        ],
        correct: 1,
        why: 'Social engineering attacks the human, not the system. Phishing, fake tech support calls, and "Hi grandma!" scams are all social engineering.'
      },
      {
        id: 'A-PV-2', layer: 'PRIVACY', topic: 'Data brokers',
        q: 'A "data broker" is:',
        a: [
          'A bank for your data',
          'A company that quietly collects, buys, and sells personal info about millions of people',
          'A person who repairs hard drives',
          'A type of cloud storage'
        ],
        correct: 1,
        why: 'Data brokers (Acxiom, LiveRamp, etc.) build profiles of you from many sources and sell them to advertisers — sometimes to scammers.'
      },
      {
        id: 'A-PV-3', layer: 'PRIVACY', topic: 'Geolocation',
        q: 'Why is the geolocation in a photo (location info saved with the picture) risky to share?',
        a: [
          'It uses too much battery',
          'It can reveal exactly where you live or hang out — even if you never said so',
          'It makes photos blurry',
          'It is illegal'
        ],
        correct: 1,
        why: 'Phones save GPS coordinates inside photos. Sharing the original file shares your exact location. Strip metadata before posting.'
      }
    ],
    RANSOMWARE: [
      {
        id: 'A-RW-1', layer: 'RANSOMWARE', topic: 'Backups',
        q: 'A good backup strategy follows the "3-2-1 rule":',
        a: [
          'Back up 3 times a day, 2 times a week, 1 time a year',
          '3 copies of your data, on 2 different types of storage, with 1 copy off-site',
          '3 passwords, 2 locks, 1 key',
          '3 friends should know your password'
        ],
        correct: 1,
        why: '3 copies + 2 media + 1 off-site = ransomware loses leverage. If your live files get locked, the off-site copy is safe.'
      },
      {
        id: 'A-RW-2', layer: 'RANSOMWARE', topic: 'Why not pay',
        q: 'Why do cybersecurity experts almost always recommend NOT paying ransom?',
        a: [
          'Bitcoin is illegal',
          'Paying does not guarantee file recovery, marks you as a paying target, and funds the next attack on someone else',
          'Banks block all ransom payments',
          'It is too expensive'
        ],
        correct: 1,
        why: 'About half of ransom payers never get their files back. Every payment funds the criminals to attack more victims.'
      },
      {
        id: 'A-RW-3', layer: 'RANSOMWARE', topic: 'Common entry',
        q: 'What is the #1 way ransomware actually gets into devices?',
        a: [
          'Government hackers planting it',
          'A user clicking a phishing email link or opening a malicious attachment',
          'Wi-Fi networks with weak signals',
          'Browser autoplay videos'
        ],
        correct: 1,
        why: 'Most ransomware starts with a single phishing email. Awareness and slow-down-before-clicking are the cheapest defenses.'
      }
    ]
  };

  const QUESTION_SETS = { BEGINNER, INTERMEDIATE, ADVANCED };
  PQ.QUESTION_SETS = QUESTION_SETS;

  // Flat list for sanity checks
  PQ.QUESTIONS = [];
  for (const diff of DIFFICULTIES) {
    for (const layer of Object.keys(LAYERS)) {
      for (const q of QUESTION_SETS[diff][layer]) PQ.QUESTIONS.push(q);
    }
  }

  // Total questions a full run contains — 5 levels × 3 blocks.
  // Grade calc divides by this fixed number regardless of how many blocks the
  // player actually attempted, so skipping is a real cost.
  PQ.TOTAL_QUESTIONS = 15;

  PQ.getQuestionForBlock = function (layer, index, difficulty) {
    difficulty = difficulty || 'INTERMEDIATE';
    const set = (QUESTION_SETS[difficulty] || QUESTION_SETS.INTERMEDIATE)[layer];
    if (!set) return null;
    return set[((index % set.length) + set.length) % set.length];
  };

  // Layer-introduction copy shown before each level starts.
  PQ.LAYER_INTROS = {
    PHISHING:   'Welcome to Phishing Lake. Scammers throw out fake messages like baited hooks — emails, texts, DMs that pretend to be your bank, your favorite game, or even a friend. Your job is to spot the bait before you bite.',
    PASSWORD:   'Welcome to Password Castle. Behind every locked door is something valuable — your accounts, your data, your identity. Strong, unique passwords (and 2FA) are the keys that keep the castle safe.',
    MALWARE:    'Welcome to Malware Forest. Hidden among the trees are sketchy downloads, fake "free game" links, and disguised programs. Trojans, viruses, and spyware all live here — learn to spot them before they bite.',
    PRIVACY:    'Welcome to Privacy Plaza. Every step you take online leaves footprints. Personal info, photos, locations — once shared, they are hard to take back. Choose carefully who knows what about you.',
    RANSOMWARE: 'Welcome to Ransomware Vault. The final boss locks your files and demands payment to release them. The only winning move is to never get hit in the first place — backups, updates, and never trusting strange attachments.'
  };

  try { console.log(`[CQ] ${PQ.QUESTIONS.length} questions / ${DIFFICULTIES.length} tiers / ${Object.keys(LAYERS).length} threat domains`); } catch (e) {}
})();
