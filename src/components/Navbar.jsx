import React, { useEffect, useState, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { styles } from '../styles';
import { navLinks } from '../constans';
import { logo, menu, close } from '../assets';

const NavItem = memo(({ id, name, active, handleClick }) => (
  <li 
    className={`${
      active === id ? "text-foreground" : "text-foreground-muted"
    } hover:text-foreground text-base font-medium transition-colors`}
  >
    <a href={`#${id}`} onClick={(e) => { e.preventDefault(); handleClick(id); }}>
      {name}
    </a>
  </li>
));

const MobileNavItem = memo(({ id, name, active, handleClick, setToggle }) => (
  <li 
    className={`${
      active === id ? "text-foreground" : "text-foreground-muted"
    } font-medium text-base hover:text-foreground`}
  >
    <a
      href={`#${id}`}
      onClick={(e) => {
        e.preventDefault();
        setToggle(false);
        handleClick(id);
      }}
    >
      {name}
    </a>
  </li>
));

const Navbar = () => {
  const [active, setActive] = useState("");
  const [toggle, setToggle] = useState(false);

  // Sync active state with URL hash on mount and hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setActive(hash);
      }
    };

    // Set initial state
    handleHashChange();
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleClick = useCallback((name) => {
    setActive(name);
    const element = document.getElementById(name);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      // Update URL hash without triggering scroll
      window.history.pushState(null, '', `#${name}`);
    }
  }, []);

  return (
    <nav
      className="w-full fixed top-0 z-50 border-b border-line bg-background/80 backdrop-blur-md"
    >
      <div className={`${styles.container} flex justify-between items-center py-4`}>
        <Link 
          to="/"
          className="flex items-center gap-2"
          onClick={() => {
            setActive("");
            window.scrollTo(0, 0);
          }}
        >
          <img src={logo} alt="logo" className="h-9 w-9 object-contain" />
          <p className='text-foreground text-lg font-bold'>Youssef El Hadraoui</p>
        </Link>
        
        <ul className='list-none hidden sm:flex flex-row gap-10'>
          {navLinks.map((link) => (
            <NavItem 
              key={link.id}
              id={link.id}
              name={link.title}
              active={active}
              handleClick={handleClick}
            />
          ))}
        </ul>
        
        <div className="sm:hidden flex flex-1 justify-end items-center">
          <img
            src={toggle ? close : menu}
            alt="menu"
            className="h-7 w-7 cursor-pointer object-contain"
            onClick={() => setToggle(!toggle)}
          />
          <div
            className={`${
              !toggle ? "hidden" : "flex"
            } p-6 bg-surface border border-line absolute top-16 right-0 mx-4 my-2 min-w-[10rem] z-50 rounded-xl`}
          >
            <ul className='list-none flex flex-col gap-4 justify-end items-start'>
              {navLinks.map((link) => (
                <MobileNavItem
                  key={link.id}
                  id={link.id}
                  name={link.title}
                  active={active}
                  handleClick={handleClick}
                  setToggle={setToggle}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default memo(Navbar);
