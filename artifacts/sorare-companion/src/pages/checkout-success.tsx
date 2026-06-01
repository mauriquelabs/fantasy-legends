import { CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function CheckoutSuccess() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 max-w-md mx-auto">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Payment successful!</h1>
        <p className="text-muted-foreground">
          Thanks for your purchase. A receipt has been sent to your email.
        </p>
      </div>
      <Link href="/pricing">
        <button className="rounded-md bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
          Back to Pricing
        </button>
      </Link>
    </div>
  );
}
