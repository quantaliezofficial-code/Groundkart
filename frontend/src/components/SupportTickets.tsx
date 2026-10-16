import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useMyTickets, useCreateTicket, useTicketDetail, useAddComment } from '../hooks/useSupport';
import { AlertTriangle, MessageSquare, Plus, ArrowLeft, Send } from 'lucide-react';
import GroundSelect from './ui/GroundSelect';
import type { ApiSupportTicket, ApiTicketEvent } from '../lib/api/types';

function dateTimeStr(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SupportTickets({ defaultContext }: { defaultContext?: { type: 'booking' | 'venue'; id: string } | null }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTicketId = searchParams.get('ticketId');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(urlTicketId);
  const [isCreating, setIsCreating] = useState(!!defaultContext && !urlTicketId);

  const { data: tickets, isLoading } = useMyTickets();

  useEffect(() => {
    if (urlTicketId) {
      setSelectedTicketId(urlTicketId);
      setIsCreating(false);
    } else {
      setSelectedTicketId(null);
    }
  }, [urlTicketId]);

  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('ticketId', id);
      return next;
    });
  };

  const handleBack = () => {
    setSelectedTicketId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('ticketId');
      return next;
    });
  };

  if (!user) return null;

  if (selectedTicketId) {
    return (
      <TicketDetailView 
        ticketId={selectedTicketId} 
        onBack={handleBack} 
      />
    );
  }

  if (isCreating) {
    return <CreateTicketView onBack={() => setIsCreating(false)} defaultContext={defaultContext} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold text-ink">Support Tickets</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-sans text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {isLoading ? (
        <div className="shimmer h-64 rounded-2xl" />
      ) : !tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container py-20 text-center">
          <MessageSquare size={48} className="text-on-surface-variant opacity-20 mb-4" />
          <h3 className="font-sans text-lg font-medium text-ink">No support tickets</h3>
          <p className="mt-2 font-sans text-sm text-on-surface-variant max-w-md">
            If you're experiencing any issues with a booking, venue, or your account, create a support ticket and our team will help you out.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map((ticket: ApiSupportTicket) => (
            <button
              key={ticket.id}
              onClick={() => handleSelectTicket(ticket.id)}
              className="flex w-full flex-col gap-2 rounded-2xl bg-surface-container p-5 text-left transition hover:bg-surface-container-high"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-sans text-base font-medium text-ink">{ticket.subject}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-800">
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex gap-3 font-sans text-sm text-on-surface-variant">
                <span className="capitalize">{ticket.category.replace('_', ' ')}</span>
                <span>•</span>
                <span>{dateTimeStr(ticket.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTicketView({ onBack, defaultContext }: { onBack: () => void; defaultContext?: { type: 'booking' | 'venue'; id: string } | null }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [error, setError] = useState('');
  const createTicket = useCreateTicket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    try {
      await createTicket.mutateAsync({
        subject,
        description,
        category: category as any,
        priority: 'medium',
        booking_id: defaultContext?.type === 'booking' ? defaultContext.id : undefined,
        venue_id: defaultContext?.type === 'venue' ? defaultContext.id : undefined,
      });
      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    }
  };

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant hover:text-ink">
        <ArrowLeft size={16} /> Back to tickets
      </button>
      <div className="rounded-2xl bg-surface-container p-6">
        <h2 className="mb-6 font-sans text-xl font-semibold text-ink">Create Support Ticket</h2>
        {error && <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {defaultContext && (
          <div className="mb-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
            <AlertTriangle size={16} /> 
            This ticket will automatically be linked to your {defaultContext.type}.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-sans text-sm font-medium text-ink">Category</label>
            <GroundSelect
              value={category}
              onValueChange={setCategory}
              options={[
                { value: 'general', label: 'General Query' },
                { value: 'billing', label: 'Billing Issue' },
                { value: 'venue_issue', label: 'Venue Issue' },
                { value: 'dispute', label: 'Dispute' }
              ]}
              triggerClassName="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-sans text-sm font-medium text-ink">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-ink/20 bg-transparent px-4 py-3 font-sans outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              placeholder="Brief description of the issue"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-sans text-sm font-medium text-ink">Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-32 w-full resize-none rounded-xl border border-ink/20 bg-transparent px-4 py-3 font-sans outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              placeholder="Provide as much context as possible..."
            />
          </div>
          <button
            type="submit"
            disabled={createTicket.isPending}
            className="w-full rounded-xl bg-emerald-600 py-3 font-sans font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {createTicket.isPending ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TicketDetailView({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { data: ticket, isLoading, isError } = useTicketDetail(ticketId);
  const [comment, setComment] = useState('');
  const addComment = useAddComment(ticketId);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl pt-6"><div className="shimmer h-96 rounded-2xl" /></div>;
  }

  if (isError || !ticket) {
    return (
      <div className="mx-auto max-w-3xl pt-6 space-y-4">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant hover:text-ink">
          <ArrowLeft size={16} /> Back to tickets
        </button>
        <div className="rounded-2xl bg-surface-container p-8 text-center">
          <p className="font-sans text-sm text-on-surface-variant">Ticket not found or no longer accessible.</p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!comment.trim()) return;
    await addComment.mutateAsync({ comment, internal: false });
    setComment('');
  };

  return (
    <div className="mx-auto max-w-3xl flex flex-col h-[calc(100vh-120px)] pt-6">
      <button onClick={onBack} className="mb-6 flex shrink-0 items-center gap-2 text-sm text-on-surface-variant hover:text-ink">
        <ArrowLeft size={16} /> Back to tickets
      </button>

      <div className="flex shrink-0 items-start justify-between rounded-t-2xl bg-surface-container p-6 border-b border-ink/10">
        <div>
          <h2 className="font-sans text-xl font-semibold text-ink">{ticket.subject}</h2>
          <div className="mt-2 flex gap-3 font-sans text-sm text-on-surface-variant">
            <span>Ticket #{ticket.id.slice(0, 8)}</span>
            <span>•</span>
            <span>Created {dateTimeStr(ticket.created_at)}</span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold uppercase text-emerald-800">
          {ticket.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface-container p-6 space-y-6">
        <div className="flex gap-4">
          <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
            U
          </div>
          <div className="flex-1 rounded-2xl rounded-tl-none bg-surface-container-high p-4">
            <p className="whitespace-pre-wrap font-sans text-sm text-ink">{ticket.description}</p>
          </div>
        </div>

        {ticket.events?.filter((e: ApiTicketEvent) => e.event_type === 'comment').map((event: ApiTicketEvent) => (
          <div key={event.id} className={`flex gap-4 ${event.actor_id === ticket.creator_id ? '' : 'flex-row-reverse'}`}>
            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${event.actor_id === ticket.creator_id ? 'bg-emerald-600' : 'bg-ink'}`}>
              {event.actor_id === ticket.creator_id ? 'U' : 'A'}
            </div>
            <div className={`flex-1 rounded-2xl p-4 ${event.actor_id === ticket.creator_id ? 'rounded-tl-none bg-surface-container-high text-ink' : 'rounded-tr-none bg-ink text-chalk'}`}>
              <p className="whitespace-pre-wrap font-sans text-sm">{event.comment}</p>
              <div className={`mt-2 text-[10px] ${event.actor_id === ticket.creator_id ? 'text-on-surface-variant' : 'text-chalk/70'}`}>
                {dateTimeStr(event.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 bg-surface-container p-4 rounded-b-2xl border-t border-ink/10">
        <div className="flex gap-3">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a reply..."
            className="flex-1 rounded-xl border border-ink/20 bg-transparent px-4 py-3 font-sans outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            disabled={ticket.status === 'closed'}
          />
          <button
            onClick={handleSend}
            disabled={addComment.isPending || !comment.trim() || ticket.status === 'closed'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

