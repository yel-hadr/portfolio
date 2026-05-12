import React, { useEffect, useState, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { styles } from '../styles';
import { navLinks } from '../constans';
import { logo, menu, close } from '../assets';

const NavItem = memo(({ name, active, handleClick }) => (
  <li 
    className={`${
      active === name ? "text-white" : "text-secondary"
    } hover:text-white text-[18px] font-medium cursor-pointer transition-colors`}
  >
    <a href={`#${name}`} onClick={(e) => { e.preventDefault(); handleClick(name); }}>
      {name}
    </a>
  </li>
));

const MobileNavItem = memo(({ name, active, handleClick, setToggle }) => (
  <li 
    className={`${
      active === name ? "text-white" : "text-secondary"
    } font-poppins font-medium cursor-pointer text-[16px] hover:text-white`}
    onClick={() => {
      setToggle(false);
      handleClick(name);
    }}
  >
    <a href={`#${name}`}>{name}</a>
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
      className={`${styles.paddingX} w-full flex items-center py-5 fixed top-0 z-50 bg-black/80 backdrop-blur-md`}
    >
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <Link 
          to="/"
          className="flex items-center gap-2"
          onClick={() => {
            setActive("");
            window.scrollTo(0, 0);
          }}
        >
          <img src={logo} alt="logo" className="h-9 w-9 object-contain" />
          <p className='text-white text-[18px] font-bold cursor-pointer'>
            Youssef el hadraoui &nbsp;
            <span className="sm:block hidden">| Portfolio</span>
          </p>
        </Link>
        
        <ul className='list-none hidden sm:flex flex-row gap-10'>
          {navLinks.map((link) => (
            <NavItem 
              key={link.id}
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
            className="h-[28px] w-[28px] cursor-pointer object-contain"
            onClick={() => setToggle(!toggle)}
          />
          <div
            className={`${
              !toggle ? "hidden" : "flex"
            } p-6 black-gradient absolute top-20 right-0 mx-4 my-2 min-w-[140px] z-50 rounded-xl`}
          >
            <ul className='list-none flex flex-col gap-4 justify-end items-start'>
              {navLinks.map((link) => (
                <MobileNavItem
                  key={link.id}
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
