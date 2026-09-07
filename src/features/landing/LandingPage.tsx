import "./LandingPage.css";
import { LandingNav } from "./components/LandingNav";
import { HeroSection } from "./components/HeroSection";
import { IntegrationsMarquee } from "./components/IntegrationsMarquee";
import { FeaturesBentoGrid } from "./components/FeaturesBentoGrid";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { RoiMetricsSection } from "./components/RoiMetricsSection";
import { PricingTiersSection } from "./components/PricingTiersSection";
import { CtaBanner } from "./components/CtaBanner";
import { LandingFooter } from "./components/LandingFooter";

export function LandingPage() {
  return (
    <div className="landing-container">
      <LandingNav />
      <main>
        <HeroSection />
        <IntegrationsMarquee />
        <FeaturesBentoGrid />
        <HowItWorksSection />
        <RoiMetricsSection />
        <PricingTiersSection />
        <CtaBanner />
      </main>
      <LandingFooter />
    </div>
  );
}
