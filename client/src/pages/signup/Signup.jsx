import { SignUp } from "@clerk/clerk-react";

const SignInPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
      <SignUp routing="path" path="/signup" />
    </div>
  );
};

export default SignInPage;