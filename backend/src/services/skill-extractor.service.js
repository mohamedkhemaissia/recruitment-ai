const skillDefinitions = [
  ['React', ['react', 'react.js', 'reactjs']],
  ['Angular', ['angular', 'angular.js', 'angularjs']],
  ['Vue.js', ['vue', 'vue.js', 'vuejs']],
  ['JavaScript', ['javascript', 'java script', 'ecmascript']],
  ['TypeScript', ['typescript', 'type script']],
  ['Node.js', ['node.js', 'nodejs', 'node js']],
  ['Express', ['express', 'express.js', 'expressjs']],
  ['HTML', ['html', 'html5']],
  ['CSS', ['css', 'css3']],
  ['PostgreSQL', ['postgresql', 'postgres', 'postgre sql']],
  ['MySQL', ['mysql', 'my sql']],
  ['MongoDB', ['mongodb', 'mongo db']],
  ['SQL', ['sql']],
  ['API REST', ['api rest', 'rest api', 'restful api']],
  ['Git', ['git', 'github', 'gitlab']],
  ['Python', ['python']],
  ['Java', ['java']],
  ['C#', ['c#', 'c sharp']],
  ['C++', ['c++', 'cpp']],
  ['.NET', ['.net', 'dotnet', 'asp.net']],
  ['Spring Boot', ['spring boot', 'springboot']],
  ['Docker', ['docker']],
  ['Kubernetes', ['kubernetes', 'k8s']],
  ['Linux', ['linux']],
  ['AWS', ['aws', 'amazon web services']],
  ['Azure', ['azure', 'microsoft azure']],
  ['Machine Learning', ['machine learning', 'apprentissage automatique']],
  ['NLP', ['nlp', 'traitement du langage naturel']],
  ['TensorFlow', ['tensorflow']],
  ['PyTorch', ['pytorch']],
  ['Data Analysis', ['data analysis', 'analyse de donnees', 'analyse des donnees']],
  ['Power BI', ['power bi', 'powerbi']],
  ['Excel', ['excel', 'microsoft excel']],
  ['Figma', ['figma']],
  ['UI/UX', ['ui/ux', 'ui ux', 'ux/ui', 'ux ui']],
  ['Agile', ['agile', 'methodologie agile']],
  ['Scrum', ['scrum']],
  ['Communication', ['communication']],
  ['Leadership', ['leadership']],
  ['Travail en équipe', ['travail en equipe', 'esprit d equipe', 'teamwork']],
  ['Résolution de problèmes', ['resolution de problemes', 'problem solving']],
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const compiledDefinitions = skillDefinitions.map(([name, aliases]) => ({
  name,
  patterns: aliases.map((alias) => new RegExp(
    `(^|[^a-z0-9+#])${escapeRegExp(normalize(alias))}(?=$|[^a-z0-9+#])`,
    'i',
  )),
}));

export function createSkillExtractor() {
  return {
    extract(text) {
      const normalizedText = normalize(text);
      return compiledDefinitions
        .filter(({ patterns }) => patterns.some((pattern) => pattern.test(normalizedText)))
        .map(({ name }) => name);
    },
  };
}
