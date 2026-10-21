import {
  mobile,
  backend,
  creator,
  web,
  javascript,
  html,
  css,
  reactjs,
  tailwind,
  git,
  docker,
  cpp,
  python,
} from '../assets';

// Name, headline and summary, as on the resume. Used by the Hero, About and Footer.
export const person = {
  name: 'Youssef El Hadraoui',
  alias: 'Jebril',
  title: 'Software Engineer | Cloud Infrastructure & DevOps',
  summary:
    'Software Engineer specializing in multi-tenant backend architecture, cloud infrastructure, and DevOps automation. Proven experience in designing scalable microservices, implementing GitOps delivery pipelines, and managing containerized environments. Passionate about automating server setups, observability, and integrating AI coding assistants into modern development workflows.',
  github: 'https://github.com/yel-hadr',
};

export const navLinks = [
  {
    id: 'about',
    title: 'About',
  },
  {
    id: 'experience',
    title: 'Experience',
  },
  {
    id: 'works',
    title: 'Projects',
  },
  {
    id: 'education',
    title: 'Education',
  },
  {
    id: 'contact',
    title: 'Contact',
  },
];

const services = [
  {
    title: 'Backend Architecture',
    icon: backend,
  },
  {
    title: 'Cloud Infrastructure',
    icon: web,
  },
  {
    title: 'DevOps & GitOps',
    icon: mobile,
  },
  {
    title: 'Automation & Observability',
    icon: creator,
  },
];

const technologies = [
  {
    name: 'C++',
    icon: cpp,
  },
  {
    name: 'Python',
    icon: python,
  },
  {
    name: 'Git',
    icon: git,
  },
  {
    name: 'Docker',
    icon: docker,
  },
  {
    name: 'HTML 5',
    icon: html,
  },
  {
    name: 'CSS 3',
    icon: css,
  },
  {
    name: 'JavaScript',
    icon: javascript,
  },
  {
    name: 'React JS',
    icon: reactjs,
  },
  {
    name: 'Tailwind CSS',
    icon: tailwind,
  },
];

// Dates are left empty until they are confirmed; the timeline hides an empty date.
const experiences = [
  {
    title: 'Lead Backend Engineer & DevOps Infrastructure Lead',
    company_name: 'Legaliox',
    iconBg: '#FF6500',
    date: '',
    points: [
      'Lead the backend of Legaliox, a multi-tenant legal SaaS platform.',
      'Design and build the API and its business logic for every tenant.',
      'Run the DevOps infrastructure the platform is built, shipped and hosted on.',
    ],
  },
  {
    title: 'Software Engineering Intern',
    company_name: 'WePartner Consulting',
    iconBg: '#a78bfa',
    date: '',
    points: ['Built an AI-powered agent that analyzes resumes.'],
  },
];

const projects = [
  {
    name: 'BADASS Network Architecture',
    description:
      'A data-center network design: VXLAN overlays with a BGP EVPN control plane, routed with FRRouting.',
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
    name: 'Cloud-1 Automation',
    description:
      'Automated deployment of a WordPress and MariaDB stack on AWS: Terraform provisions the infrastructure and Ansible configures the host.',
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
  },
  {
    name: 'Inception-of-Things',
    description:
      'Kubernetes from the ground up: K3s clusters on Vagrant VMs, Traefik ingress with host-based routing, then K3d with Argo CD deploying from Git.',
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
  },
  {
    name: 'Interactive 3D Portfolio',
    description:
      'This site: React with React Three Fiber scenes sharing one WebGL canvas, a canvas wave background and Tailwind design tokens.',
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
];

const education = [
  {
    school: '42 Paris',
    degree: 'RNCP Level 7, Network & Information Systems Architecture',
    date: 'September 2026',
    points: [],
  },
  {
    school: '1337 Coding School',
    degree: 'Common Core',
    date: '2022 – 2024',
    points: [
      'Peer-to-peer, project-based curriculum: C and C++, UNIX processes and signals, networking, graphics and containers with Docker.',
    ],
  },
];

export { services, technologies, experiences, projects, education };
