import { SectionWrapper } from '../hoc'
import { technologies } from '../constans'
import { Ball, SceneView } from './canvas'

const Tech = () => {
  return (
    <div className='flex flex-wrap flex-row justify-center gap-10'>
      {technologies.map((tech) => (
        <SceneView
          key={tech.name}
          sectionType='ball'
          label={tech.name}
          className='w-28 h-28'
          fallback={<span className='flex h-full items-center justify-center text-secondary'>{tech.name}</span>}
        >
          <Ball imgUrl={tech.icon} />
        </SceneView>
      ))}
    </div>
  )
}

export default SectionWrapper(Tech, "tech")
