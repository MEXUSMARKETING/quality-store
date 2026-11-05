import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <span dir="ltr" className="font-logo font-bold text-[40px]">Quality</span>
      <h1 className="font-display font-bold text-2xl">העמוד לא נמצא</h1>
      <Link href="/" className="btn btn-dark">לדף הבית</Link>
    </div>
  );
}
