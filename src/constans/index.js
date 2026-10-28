import {
  mobile,
  backend,
  creator,
  web,
  aws,
  terraform,
  ansible,
  kubernetes,
  argocd,
  docker,
  linux,
  nginx,
  python,
  cpp,
  git,
  reactjs,
} from '../assets';

// Language-independent facts. All user-facing text (title, summary, descriptions...) lives in
// the dictionaries in src/locales/<lang>/core.json, keyed by the ids below.
export const person = {
  name: 'Youssef El Hadraoui',
  alias: 'Jebril',
  email: 'youssefelhadraoui99@gmail.com',
  linkedin: 'https://www.linkedin.com/in/youssef-el-hadraoui',
  github: 'https://github.com/yel-hadr',
  // public/Youssef_Elhadraoui_Resume.pdf, resolved against Vite's base path
  resume: `${import.meta.env.BASE_URL}Youssef_Elhadraoui_Resume.pdf`,
};

// Labels: nav.<id> in the dictionaries
export const navLinks = [
  { id: 'about' },
  { id: 'experience' },
  { id: 'works' },
  { id: 'education' },
  { id: 'contact' },
];

// Labels: about.services.<id>
const services = [
  {
    id: 'backend',
    icon: backend,
  },
  {
    id: 'cloud',
    icon: web,
  },
  {
    id: 'devops',
    icon: mobile,
  },
  {
    id: 'automation',
    icon: creator,
  },
];

const technologies = [
  {
    name: 'AWS',
    icon: aws,
  },
  {
    name: 'Terraform',
    icon: terraform,
  },
  {
    name: 'Ansible',
    icon: ansible,
  },
  {
    name: 'Kubernetes',
    icon: kubernetes,
  },
  {
    name: 'Argo CD',
    icon: argocd,
  },
  {
    name: 'Docker',
    icon: docker,
  },
  {
    name: 'Linux',
    icon: linux,
  },
  {
    name: 'Nginx',
    icon: nginx,
  },
  {
    name: 'Python',
    icon: python,
  },
  {
    name: 'C++',
    icon: cpp,
  },
  {
    name: 'Git',
    icon: git,
  },
  {
    name: 'React',
    icon: reactjs,
  },
];

// Dates are left empty until they are confirmed; the timeline hides an empty date.
// Title and points: experience.items.<id>
const experiences = [
  {
    id: 'legaliox',
    company_name: 'Legaliox',
    iconBg: 'var(--color-primary)',
    date: '',
  },
  {
    id: 'wepartner',
    company_name: 'WePartner Consulting',
    iconBg: 'var(--color-secondary)',
    date: '',
  },
];

// Name and description: works.items.<id>. `diagram` opens an architecture diagram modal.
const projects = [
  {
    id: 'badass',
    tags: [
      {
        name: 'BGP EVPN',
        color: 'blue-text-gradient',
      },
      {
        name: 'VXLAN',
        color: 'green-text-gradient',
      },
      {
        name: 'FRRouting',
        color: 'pink-text-gradient',
      },
    ],
    source_code_link: '',
  },
  {
    id: 'cloud1',
    tags: [
      {
        name: 'AWS',
        color: 'orange-text-gradient',
      },
      {
        name: 'Terraform',
        color: 'blue-text-gradient',
      },
      {
        name: 'Ansible',
        color: 'pink-text-gradient',
      },
      {
        name: 'WordPress / MariaDB',
        color: 'green-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/cloud-1_42',
    diagram: 'cloud1',
  },
  {
    id: 'iot',
    tags: [
      {
        name: 'Vagrant',
        color: 'blue-text-gradient',
      },
      {
        name: 'K3s',
        color: 'green-text-gradient',
      },
      {
        name: 'Traefik',
        color: 'pink-text-gradient',
      },
      {
        name: 'K3d',
        color: 'green-text-gradient',
      },
      {
        name: 'Argo CD',
        color: 'orange-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/-Inception-of-Things',
    diagram: 'iot',
  },
  {
    id: 'portfolio',
    tags: [
      {
        name: 'React',
        color: 'blue-text-gradient',
      },
      {
        name: 'Three.js',
        color: 'pink-text-gradient',
      },
      {
        name: 'Tailwind CSS',
        color: 'green-text-gradient',
      },
    ],
    source_code_link: 'https://github.com/yel-hadr/portfolio',
  },
  // 42 graphics projects with a live web demo (`demo`: the dialog Works opens)
  {
    id: 'cub3d',
    tags: [
      { name: 'C', color: 'blue-text-gradient' },
      { name: 'MLX42', color: 'green-text-gradient' },
      { name: 'Raycasting', color: 'orange-text-gradient' },
    ],
    source_code_link: 'https://github.com/yel-hadr/cub3D_42',
    demo: 'cub3d',
  },
  {
    id: 'fdf',
    tags: [
      { name: 'C', color: 'blue-text-gradient' },
      { name: 'MiniLibX', color: 'green-text-gradient' },
      { name: 'Isometric projection', color: 'orange-text-gradient' },
    ],
    source_code_link: 'https://github.com/yel-hadr/my_fdf_42',
    demo: 'fdf',
  },
];

// Degree, date and points: education.items.<id>
const education = [
  { id: 'paris42', school: '42 Paris' },
  { id: 'school1337', school: '1337 Coding School' },
];

// Terminal challenge (`game` in the terminal): the commands to type, by difficulty. Plain text
// only, rendered as text nodes; edit freely.
const typingCommands = {
  easy: ['ls', 'cd ~', 'pwd', 'whoami', 'clear'],
  medium: ['sudo systemctl restart nginx', 'docker ps', 'kubectl get pods'],
  hard: [
    'terraform apply -auto-approve',
    'kubectl rollout restart deployment/app',
    'docker-compose up -d --build',
  ],
};

// Its clock: seconds at the start, seconds added per fixed command
const typingChallenge = { seconds: 30, bonus: 5 };

// localStorage keys of the mini-games' best scores
const gameStorage = {
  snake: 'packet_snake_high_score',
  typing: 'typing_high_score',
};

export {
  services,
  technologies,
  experiences,
  projects,
  education,
  typingCommands,
  typingChallenge,
  gameStorage,
};
export { posts } from './posts.js';
