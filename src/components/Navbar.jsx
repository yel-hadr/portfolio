import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {styles } from '../styles'


import { navLinks } from '../constans'
import { logo , menu , close } from '../assets'


const Navbar = () => {
  const [active, setActive] = useState("");
  const [Toggle, setToggle] = useState(false);
  return (
    <nav
      className={`${styles.paddingX} w-full flex items-center py-5 fixed top-0 z-10 bg-black`}
    >
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <Link 
          to="/"
          className="flex items-center gap-2"
          onClick={
            () => {
              setActive("");
              window.scrollTo(0, 0);
            }
          }
          >

        
          <img src={logo} alt="logo" className="h-9 w-9 object-contain" />
          <p className='text-white text-[18px] font-bold cursor-pointer'
              >Youssef el hadraoui &nbsp;
              <span className="sm:block hidden">| Portfolio</span>
          </p>
        </Link>
        <ul className='list-none  hidden sm:flex flex-row gap-10'>
          {
            navLinks.map((link) => (
              <li 
                key={link.id}
                className={`${
                  active === link.id ? " text-white" : "text-secondary"
                } hover:text-white text-[18px] font-medium cursor-pointer`}
                onClick={() => setActive(link.title)} 
              >
                <a href={`#${link.id}`} >{link.title}</a>
              </li>
            ))
          }
        </ul>
        <div className="sm:hidden flex flex-1 justify-end items-center">
          <img
            src={Toggle ? close : menu}
            alt="menu"
            className="h-[28px] w-[28px] cursor-pointer object-contain"
            onClick={() => setToggle(!Toggle)}
          />
          <div
            className={`${
              !Toggle ? "hidden" : "flex"} p-6 black-gradient absolute top-20 right-0 mx-4 my-2 min-w-[140px] z-10 rounded-xl
            `}
          >
            <ul className='list-none  flex flex-col gap-4 justify-end items-start'>
              {
                navLinks.map((link) => (
                  <li 
                    key={link.id}
                    className={`${
                      active === link.id ? " text-white" : "text-secondary"
                    } font-poppins font-medium cursor-pointer text-[16px]
                    hover:text-white
                    `}
                    onClick={() => {
                      setToggle(!Toggle)
                      setActive(link.title)
                    }} 
                  >
                    <a href={`#${link.id}`} >{link.title}</a>
                  </li>
                ))
              }
            </ul>

          </div>
        </div>

      </div>
    </nav>
  )
}

export default Navbar