import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { platform } from '../lib/platform'
export const useCompatibility = profile => {
  const [results,setResults]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const scheduleKey=JSON.stringify(profile?.weeklySchedule)
  useEffect(()=>{
    if(!profile?.uid) return
    let active=true, sequence=0
    const unsub=onSnapshot(collection(db,'properties'),async snap=>{
      const request=++sequence,properties=snap.docs.map(d=>({id:d.id,...d.data(),score:null}))
      setResults(properties);setLoading(false)
      try{const response=await platform('matching');if(active&&request===sequence){const scores=new Map(response.results.map(r=>[r.id,r.score]));setResults(properties.map(p=>({...p,score:scores.get(p.id)??null})).sort((a,b)=>(b.score??-1)-(a.score??-1)));setError('')}}catch(e){if(active)setError(e.message)}
    },e=>{setError(e.message);setLoading(false)})
    return()=>{active=false;unsub()}
  },[profile?.uid,profile?.gender,scheduleKey])
  return {results,loading,error}
}
