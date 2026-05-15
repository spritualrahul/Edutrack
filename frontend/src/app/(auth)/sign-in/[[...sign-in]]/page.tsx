import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50/30">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg mb-4">E</div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome to EduStack</h1>
          <p className="mt-1.5 text-sm text-gray-500">Sign in to access your school dashboard</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-xl rounded-2xl border border-gray-100",
              formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 rounded-lg h-10",
              formFieldInput: "rounded-lg border-gray-200",
              footerActionLink: "text-indigo-600 hover:text-indigo-700 font-medium",
            },
          }}
        />
      </div>
    </div>
  );
}
