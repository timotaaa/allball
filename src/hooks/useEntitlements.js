import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PLAN_ENTITLEMENTS = {
  free: { teams: 1, players: 20, templates: false, analytics: false, ai: false },
  pro: { teams: 5, players: 200, templates: true, analytics: true, ai: false },
  org: { teams: 50, players: 2000, templates: true, analytics: true, ai: true }
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data }) => { 
      setUser(data.user || null); 
      setLoading(false); 
    });
    
    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Create profile if it doesn't exist
        await createUserProfile(session.user);
      }
      setUser(session?.user || null);
      setLoading(false);
    });
    
    return () => listener.subscription.unsubscribe();
  }, []);
  
  return { user, loading };
}

async function createUserProfile(user) {
  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (!existingProfile) {
      // Create new profile
      const { error } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Coach',
            plan: 'free',
            created_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        console.error('Error creating profile:', error);
      }
    }
  } catch (error) {
    console.error('Error in createUserProfile:', error);
  }
}

export function useEntitlements() {
  const { user } = useAuth();
  const [plan, setPlan] = useState('free');
  const [entitlements, setEntitlements] = useState(PLAN_ENTITLEMENTS.free);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let active = true;
    
    async function load() {
      if (!user) { 
        setPlan('free'); 
        setEntitlements(PLAN_ENTITLEMENTS.free); 
        setLoading(false);
        return; 
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        const userPlan = data?.plan || 'free';
        if (!active) return;
        
        setPlan(userPlan);
        setEntitlements(PLAN_ENTITLEMENTS[userPlan] || PLAN_ENTITLEMENTS.free);
      } catch (error) {
        console.error('Error loading entitlements:', error);
        if (active) {
          setPlan('free');
          setEntitlements(PLAN_ENTITLEMENTS.free);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    
    load();
    return () => { active = false; };
  }, [user]);
  
  return { plan, entitlements, loading };
}


