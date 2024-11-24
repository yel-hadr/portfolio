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
    carrent,
    cpp,
    python,
    
    cub3D_42,
    minishell,
    ft_irc,
    Inception,
  } from "../assets";
  
  export const navLinks = [
    {
      id: "about",
      title: "About",
    },
    {
      id: "experience",
      title: "Experience",
    },
    {
      id: "contact",
      title: "Contact",
    },
  ];
  
  const services = [
    {
      title: "DevOps Engineer",
      icon: web,
    },
    {
      title: "Full Stack Developer",
      icon: mobile,
    },
    {
      title: "Backend Developer",
      icon: backend,
    },
    {
      title: "low_level Developer",
      icon: creator,
    },
  ];
  
  const technologies = [
    {
      name: "C++",
      icon: cpp
    },
    {
      name: "python",
      icon: python,
    },
    {
      name: "git",
      icon: git,
    },
    {
      name: "docker",
      icon: docker,
    },
    {
      name: "HTML 5",
      icon: html,
    },
    {
      name: "CSS 3",
      icon: css,
    },
    {
      name: "JavaScript",
      icon: javascript,
    },
    {
      name: "React JS",
      icon: reactjs,
    },
    {
      name: "Tailwind CSS",
      icon: tailwind,
    },
  ];
  
  const experiences = [
    {
      title: "1337 Pool",
      iconBg: "#383E56",
      date: "March 2022 - April 2022",
      points: [
        "Gained proficiency in writing efficient, low-level code and debugging complex problems.",
        "Developed collaboration and communication skills through a self-directed learning model.",
        "Learned to both teach and learn from peers, fostering a community-driven growth mindset.",
        "Enhanced teamwork and adaptability through weekly team-based challenges with randomized groups.",
        "Built time management and project delivery skills by collaborating under tight deadlines.",
      ],
    },
    {
      title: "1337 Cursus Part 1 (C Programming)",
      iconBg: "#383E56",
      date: "October 2022 - December 2023",
      points: [
        "Built a custom library (libft) of reusable utility functions to streamline future projects.",
        "Mastered file and input/output operations through projects like ft_printf (recreating printf() with variable arguments) and get_next_line (reading lines from file descriptors).",
        "Enhanced algorithmic thinking by solving stack-based data sorting challenges in push_swap with efficient solutions.",
        "Gained a deep understanding of threading, synchronization, and inter-process communication through philosophers (threading basics with mutexes) and minitalk (using UNIX signals for data exchange).",
        "Explored graphics and 3D rendering with fdf (wireframe landscapes) and cub3d (ray-casting to simulate dynamic first-person navigation).",
        "Built a functional shell (minishell), deepening knowledge of system calls, file descriptors, and process management."
      ],
    },
    {
      title: "1337 Cursus Part 2 (C++ Object-Oriented Programming)",
      iconBg: "#383E56",
      date: "December 2023 - Mai 2024",
      points: [
        "Exploring the core C++ concepts including dynamic memory allocation, pointers, references, and polymorphism, with a focus on low-level memory operations and efficient data manipulation.",
        "Developed object-oriented designs using inheritance, subtype polymorphism, abstract classes, and the Orthodox Canonical Form for reusable and scalable code.",
        "Gained expertise in generic programming with C++ templates, templated containers, iterators, and STL algorithms, enhancing flexibility and performance.",
        "Built an IRC server (ft_irc), deepening my understanding of client-server architectures, networking, and protocol implementation.",
      ],
    },
    {
      title: "1337 Cursus Part 3 (Web Development & System Administration & Virtualization)",
      iconBg: "#383E56",
      date: "December 2023 - June 2024",
      points: [
        "Gained experience in making strategic decisions within project constraints, such as using Nginx and selecting appropriate external libraries for the project.",
        "Developed skills in modular development with Django, managing dependencies and ensuring smooth integration across the application.",
        "Strengthened understanding of project scoping and adaptability, staying within defined frameworks (like Django) while making thoughtful decisions to meet project goals.",
        "Gained hands-on experience in system administration and virtualization, using Docker for containerization and VirtualBox for setting up virtual machines and installing operating systems from scratch."
        
      ],
    }
  ];
  

  
  const projects = [
    {
      name: "Transcendence",
      description:
        "This project is about creating my own IRC server with C++, using the RFC 1459 as a reference. The server must be able to handle multiple clients at the same time, and the clients must be able to send messages to each other.",
      tags: [
        {
          name: "HTML/CSS",
          color: "blue-text-gradient",
        },
        {
          name: "JavaScript",
          color: "pink-text-gradient",
        },
        {
          name: "django",
          color: "green-text-gradient",
        },
      ],
      image: carrent,
      source_code_link: "https://github.com/Sbahdi/Transcendence",
    },
    {
      name: "ft_irc",
      description:
        "This project is about creating my own IRC server with C++, using the RFC 1459 as a reference. The server must be able to handle multiple clients at the same time, and the clients must be able to send messages to each other.",
      tags: [
        {
          name: "C++",
          color: "blue-text-gradient",
        },
      ],
      image: ft_irc,
      source_code_link: "https://github.com/yel-hadr/ft_irc",
    },
    {
      name: "Inception",
      description:
        "This project is about System Administration related exercise, where I have learned to work with Docker and Docker Compose. I have constructed a total of 7 containers, each with its own unique function.",
      tags: [
        {
          name: "Docker",
          color: "blue-text-gradient",
        },
      ],
      image: Inception,
      source_code_link: "https://github.com/yel-hadr/Inception",
    },
    {
      name: "cub3D_42",
      description:
        "Cub3d is a project inspired by the world-famous Wolfenstein 3D game, which was the first FPS ever. It allows you to explore ray-casting, a technique used in early video games to simulate 3D environments.",
      tags: [
        {
          name: "C",
          color: "blue-text-gradient",
        },
      ],
      image: cub3D_42,
      source_code_link: "https://github.com/yel-hadr/cub3D_42",
    },
    {
      name: "minishell",
      description:
        "Minishell is a simple shell implementation written in C. It provides a minimalistic command-line interface with basic shell functionalities.",
      tags: [
        {
          name: "C",
          color: "blue-text-gradient",
        },
      ],
      image: minishell,
      source_code_link: "https://github.com/yel-hadr/minishell",
    },
  ];
  
  export { services, technologies, experiences, projects };