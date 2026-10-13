import { avatarFor, avatarSrc } from '../../auth/profileShortcuts.ts'

/** A learner's pixel pet. Decorative: the label lives on the button that wraps it. */
export function Avatar({ id, size = 32 }: { id: string | undefined; size?: number }) {
  return (
    <img
      className="avatar-pet"
      src={avatarSrc(id)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      data-avatar={avatarFor(id).id}
    />
  )
}
