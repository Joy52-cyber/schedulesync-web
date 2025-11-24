// Import useAuth
import { useAuth } from "../contexts/AuthContext"; 

export default function OnboardingWizard() {
  const { updateUser } = useAuth(); // <--- Get the helper
  // ... existing code ...

  const handleSubmit = async () => {
    setLoading(true);
    try {
        // ... API calls to backend ...

        // ✅ UPDATE LOCAL STATE
        // This tells the ProtectedRoute that the user now has a username
        updateUser({ username: formData.username });

        navigate("/dashboard");
    } catch (error) {
        console.error("Onboarding failed", error);
    }
  };
// ...