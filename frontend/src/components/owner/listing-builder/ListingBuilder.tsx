import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownerApi } from '../../../lib/api/owner';
import { api } from '../../../lib/api/client';
import { VenueCreateRequest } from '../../../lib/api/types';
import IdentityStep from './IdentityStep';
import CategoryStep from './CategoryStep';
import LocationStep from './LocationStep';
import DetailsStep from './DetailsStep';
import MediaStep from './MediaStep';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface ListingBuilderProps {
  venueId?: string | null;
  onClose: () => void;
  onComplete: () => void;
}

export type ListingFormData = VenueCreateRequest & {
  // Temporary client-side fields if any
};

export default function ListingBuilder({ venueId, onClose, onComplete }: ListingBuilderProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ListingFormData>>({
    name: '',
    description: '',
    address: '',
    city: '',
    unit_type: 'hour',
    base_price: '',
    amenity_names: [],
  });
  const [createdVenueId, setCreatedVenueId] = useState<string | null>(venueId || null);

  const totalSteps = 5;

  const handleNext = async () => {
    // If we're moving past step 3 (Location) and haven't created the draft venue yet, create it.
    if (step === 3 && !createdVenueId) {
      try {
        // Create draft venue
        const res = await ownerApi.createVenue(formData as VenueCreateRequest);
        setCreatedVenueId(res.id);
        setStep(step + 1);
      } catch (err) {
        console.error('Failed to create venue', err);
        alert('Failed to save venue draft. Please check required fields.');
      }
    } else if (step === totalSteps) {
      // Final submit
      if (createdVenueId) {
        await ownerApi.updateVenue(createdVenueId, { ...formData, status: 'pending_review' } as any);
      }
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const updateForm = (data: Partial<ListingFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    if (createdVenueId) {
       // Autosave
       ownerApi.updateVenue(createdVenueId, data as any).catch(console.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background-mist flex flex-col">
      {/* Header */}
      <header className="bg-chalk border-b border-surface-container-high px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-mist rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h1 className="text-xl font-display font-semibold text-ink">Create your venue</h1>
            <p className="text-sm text-on-surface-variant">Step {step} of {totalSteps}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">Draft saved automatically</span>
          <button onClick={onClose} className="text-sm font-medium text-pitch hover:text-ink transition-colors">
            Save & Exit
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-surface-container-highest">
        <div 
          className="h-full bg-pitch transition-all duration-300 ease-in-out" 
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-2xl mx-auto bg-chalk rounded-2xl shadow-sm border border-surface-container-highest p-8">
          {step === 1 && <IdentityStep data={formData} update={updateForm} />}
          {step === 2 && <CategoryStep data={formData} update={updateForm} />}
          {step === 3 && <LocationStep data={formData} update={updateForm} />}
          {step === 4 && <MediaStep venueId={createdVenueId} onComplete={() => {}} />}
          {step === 5 && <DetailsStep data={formData} update={updateForm} />}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-chalk border-t border-surface-container-high px-6 py-4 flex items-center justify-between">
        <button 
          onClick={() => setStep(step - 1)} 
          disabled={step === 1}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${step === 1 ? 'text-on-surface-variant opacity-50 cursor-not-allowed' : 'text-pitch hover:text-ink'}`}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        
        <button 
          onClick={handleNext}
          className="flex items-center gap-2 bg-pitch hover:bg-ink text-chalk px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          {step === totalSteps ? (
            <>Submit for Review <Check className="w-4 h-4" /></>
          ) : (
            <>Next <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </footer>
    </div>
  );
}
