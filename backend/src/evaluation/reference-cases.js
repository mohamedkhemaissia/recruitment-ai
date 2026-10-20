const profiles = [
  {
    id: 'frontend',
    offer: {
      title: 'Développeur frontend React',
      description: 'Concevoir des interfaces web modernes, accessibles et responsives.',
      requirements: 'React, JavaScript, TypeScript, HTML, CSS, Git et API REST.',
    },
    candidates: [
      ['target', 'CV frontend confirmé', 'Développeur frontend spécialisé dans les interfaces web accessibles et responsives. Expérience avec React, JavaScript, TypeScript, HTML, CSS, Git et API REST. Tests de composants et travail Agile.'],
      ['junior', 'CV frontend junior', 'Développeur web junior ayant réalisé des interfaces avec React, JavaScript, HTML et CSS. Utilisation de Git dans des projets universitaires.'],
      ['adjacent', 'CV intégrateur web', 'Intégrateur web spécialisé en HTML, CSS et accessibilité. Notions de JavaScript, Figma et conception UI/UX.'],
    ],
  },
  {
    id: 'data',
    offer: {
      title: 'Data analyst',
      description: 'Analyser les données et construire des tableaux de bord métier.',
      requirements: 'Python, SQL, PostgreSQL, Power BI, Excel et communication.',
    },
    candidates: [
      ['target', 'CV data analyst confirmé', 'Data analyst expérimenté en analyse de données et tableaux de bord. Maîtrise de Python, SQL, PostgreSQL, Power BI et Excel. Présentation claire des indicateurs aux équipes métier.'],
      ['junior', 'CV data analyst junior', 'Analyste junior utilisant Excel, SQL et Power BI pour nettoyer les données et produire des indicateurs simples.'],
      ['adjacent', 'CV analyste métier', 'Analyste métier chargé du recueil des besoins, de la communication avec les utilisateurs et du suivi des indicateurs sous Excel.'],
    ],
  },
  {
    id: 'backend',
    offer: {
      title: 'Développeur backend Java',
      description: 'Développer des services backend fiables et sécurisés.',
      requirements: 'Java, Spring Boot, PostgreSQL, Docker, Git et API REST.',
    },
    candidates: [
      ['target', 'CV backend Java confirmé', 'Développeur backend Java expérimenté dans les applications métier. Maîtrise de Spring Boot, PostgreSQL, Docker, Git et API REST. Conception de services sécurisés.'],
      ['junior', 'CV backend Java junior', 'Développeur Java junior avec Spring Boot, SQL, Git et création de petites API REST.'],
      ['adjacent', 'CV backend Node.js', 'Développeur backend Node.js et Express. Conception d API REST avec PostgreSQL, Docker et Git.'],
    ],
  },
  {
    id: 'devops',
    offer: {
      title: 'Ingénieur DevOps Cloud',
      description: 'Automatiser les déploiements et maintenir des infrastructures cloud fiables.',
      requirements: 'Docker, Kubernetes, Linux, AWS, Azure, Git et pratiques Agile.',
    },
    candidates: [
      ['target', 'CV DevOps confirmé', 'Ingénieur DevOps responsable des déploiements et de la fiabilité des infrastructures cloud. Expérience avec Docker, Kubernetes, Linux, AWS, Azure, Git et équipes Agile.'],
      ['junior', 'CV DevOps junior', 'Administrateur Linux junior utilisant Docker, Git et quelques services AWS pour déployer des applications.'],
      ['adjacent', 'CV administrateur système', 'Administrateur système chargé des serveurs Linux, de la supervision, du support et de la résolution des incidents.'],
    ],
  },
  {
    id: 'mobile',
    offer: {
      title: 'Développeur mobile React Native',
      description: 'Concevoir et maintenir des applications mobiles multiplateformes.',
      requirements: 'React Native, JavaScript, TypeScript, API REST, Git et tests fonctionnels.',
    },
    candidates: [
      ['target', 'CV mobile confirmé', 'Développeur mobile spécialisé dans les applications multiplateformes avec React Native, JavaScript et TypeScript. Intégration d API REST, Git et tests fonctionnels.'],
      ['junior', 'CV mobile junior', 'Développeur React Native junior ayant publié une application mobile et consommé plusieurs API REST en JavaScript.'],
      ['adjacent', 'CV frontend React', 'Développeur React créant des interfaces web responsives en JavaScript, TypeScript, HTML et CSS.'],
    ],
  },
  {
    id: 'ai-nlp',
    offer: {
      title: 'Ingénieur intelligence artificielle NLP',
      description: 'Développer des solutions de traitement automatique du langage naturel.',
      requirements: 'Python, Machine Learning, NLP, PyTorch, TensorFlow, SQL et Git.',
    },
    candidates: [
      ['target', 'CV ingénieur NLP confirmé', 'Ingénieur intelligence artificielle spécialisé en NLP et traitement du langage naturel. Développement de modèles Machine Learning en Python avec PyTorch, TensorFlow, SQL et Git.'],
      ['junior', 'CV machine learning junior', 'Diplômé en intelligence artificielle avec projets Python, Machine Learning, TensorFlow et analyse de données.'],
      ['adjacent', 'CV data scientist', 'Data scientist utilisant Python, SQL, analyse de données et Machine Learning pour construire des modèles prédictifs.'],
    ],
  },
  {
    id: 'dotnet',
    offer: {
      title: 'Développeur backend .NET',
      description: 'Construire des applications métier et des API sécurisées avec Microsoft .NET.',
      requirements: 'C#, .NET, SQL, PostgreSQL, Azure, Git et API REST.',
    },
    candidates: [
      ['target', 'CV .NET confirmé', 'Développeur backend C# et .NET spécialisé dans les applications métier. Création d API REST avec SQL, PostgreSQL, Azure et Git.'],
      ['junior', 'CV .NET junior', 'Développeur C# junior avec .NET, SQL et création de services web simples.'],
      ['adjacent', 'CV Java entreprise', 'Développeur Java et Spring Boot pour applications métier, API REST, PostgreSQL et Git.'],
    ],
  },
  {
    id: 'ux',
    offer: {
      title: 'Designer UI/UX',
      description: 'Concevoir des parcours utilisateurs simples et des interfaces cohérentes.',
      requirements: 'Figma, UI/UX, HTML, CSS, communication et travail en équipe.',
    },
    candidates: [
      ['target', 'CV designer UI/UX confirmé', 'Designer UI/UX spécialisé dans la recherche utilisateur, les parcours et les prototypes Figma. Bonnes bases HTML et CSS, communication et travail en équipe.'],
      ['junior', 'CV designer UI junior', 'Designer junior réalisant des maquettes et prototypes avec Figma. Connaissances UI/UX et CSS.'],
      ['adjacent', 'CV graphiste', 'Graphiste créant des identités visuelles et supports de communication avec une sensibilité aux interfaces numériques.'],
    ],
  },
  {
    id: 'fullstack',
    offer: {
      title: 'Développeur full stack JavaScript',
      description: 'Développer une plateforme web de bout en bout avec une architecture simple.',
      requirements: 'React, Node.js, Express, JavaScript, PostgreSQL, API REST et Git.',
    },
    candidates: [
      ['target', 'CV full stack confirmé', 'Développeur full stack JavaScript avec React, Node.js et Express. Conception d API REST, bases PostgreSQL, Git et interfaces web maintenables.'],
      ['junior', 'CV full stack junior', 'Développeur JavaScript junior ayant créé des projets React et Node.js avec une base SQL.'],
      ['adjacent', 'CV backend JavaScript', 'Développeur Node.js et Express spécialisé dans les API REST, PostgreSQL, Docker et Git.'],
    ],
  },
  {
    id: 'project',
    offer: {
      title: 'Chef de projet logiciel Agile',
      description: 'Coordonner une équipe produit et assurer la livraison des projets logiciels.',
      requirements: 'Agile, Scrum, leadership, communication, Git et résolution de problèmes.',
    },
    candidates: [
      ['target', 'CV chef de projet confirmé', 'Chef de projet logiciel encadrant des équipes Agile et Scrum. Leadership, communication, suivi des livraisons Git et résolution de problèmes.'],
      ['junior', 'CV Scrum master junior', 'Scrum master junior facilitant les cérémonies Agile, la communication et le travail en équipe.'],
      ['adjacent', 'CV responsable fonctionnel', 'Responsable fonctionnel chargé des besoins métier, de la coordination des utilisateurs et du suivi des délais.'],
    ],
  },
];

export const referenceCandidates = profiles.flatMap(({ id, candidates }) => candidates.map(([suffix, label, text]) => ({
  id: `${id}-${suffix}`,
  label,
  text,
})));

export const referenceOffers = profiles.map(({ id, offer }) => ({
  id,
  expectedCandidateId: `${id}-target`,
  ...offer,
}));

export const referenceJudgments = referenceOffers.flatMap((offer) => referenceCandidates.map((candidate) => {
  let relevance = 0;
  if (candidate.id === offer.expectedCandidateId) relevance = 3;
  else if (candidate.id === `${offer.id}-junior`) relevance = 2;
  else if (candidate.id === `${offer.id}-adjacent`) relevance = 1;

  return {
    offerId: offer.id,
    candidateId: candidate.id,
    relevance,
  };
}));
