export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-brand-600">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Schweriner KC" className="size-24 animate-pulse drop-shadow-xl" />
    </div>
  )
}
