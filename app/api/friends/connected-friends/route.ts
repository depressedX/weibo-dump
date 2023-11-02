import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const COOKIE =
  "XSRF-TOKEN=ix3RuzlMn1iijPr2F2YvJ9Pk; SSOLoginState=1698836228; WBPSESS=Zn3B09d3CpXMeD4zg3rsXon0J6NtgvqsYbe3szfEagnFHbZR9MZrPKLPCtqeB6NglvzZoBQsm5Ct1gOPkelQ2hCr7ee8-h12S-3uvhLd9VEy31Fw-0CrxzbN93LaShvdOFXx_P2zmeySjFYf-Q7B-g==; SCF=AiqkF7WJoPfcdrdVT6E1n1sVcfW_yYqeZr6AIkCJbr8GoF_4n6Uta7rN69G60dxFc59gg9iVSYpuHAsJwAt1fwc.; SUB=_2A25IRl9BDeRhGeFJ7lEZ-SnPyjmIHXVrOt6JrDV8PUNbmtANLRjhkW9Nf7EEjRqbbXeRK2pSVcLn_hTvqbkVvVHo; SUBP=0033WrSXqPxfM725Ws9jqgMF55529P9D9W51TD8LsKD5kTfG-SU.FXkX5JpX5KMhUgL.FoMNSKeR1KM0eK-2dJLoIERLxK-L12qLB-qLxK-L12qLBKeLxK-L12qLB-qLxKBLBo.L1KWodXSyU8vodcpy; ALF=1701428240";

async function getFansData(uid: string): Promise<{ users: any[] }> {
  
  const localCacheFilename = `friendships_friends_relate_fans_${uid}.json`;
  const localCachePath = path.resolve("./data", localCacheFilename);
  const cached = fs.existsSync(localCachePath);
  if (cached) {
    try {
    return JSON.parse(fs.readFileSync(localCachePath).toString());
    } catch (e) {
      throw e;
      
    }
  }
  const url = `https://weibo.com/ajax/friendships/friends?relate=fans&page=1&uid=${uid}&type=all&newFollowerCount=0`;
  
  const res = await fetch(
    url,
    {
      headers: {
        "Content-Type": "application/json",
        cookie: COOKIE,
        host: 'weibo.com'
      },
    }
  );
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(await res.json())
  }
  
  let currentPageData = await res.json();
  let finalResult = currentPageData;
  let round = 0;
  while (currentPageData.next_cursor > 0 && round <= 5) {
    round++;
    const page = Math.floor(currentPageData.next_cursor / 20) + 1;
    const res = await fetch(
      `https://weibo.com/ajax/friendships/friends?relate=fans&page=${page}&uid=${uid}&type=all&newFollowerCount=0`,
      {
        headers: {
          "Content-Type": "application/json",
          cookie: COOKIE,
        },
      }
    );
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new Error(await res.json())
    }
    currentPageData = await res.json()
    finalResult.users.push(...(currentPageData.users || []))

    console.log(
      "get fans",
      page,
      uid,
      currentPageData.users ? currentPageData.users.map((v) => v.name).join("|") : "null",
      currentPageData.next_cursor
    );
  }

  fs.writeFileSync(localCachePath, JSON.stringify(finalResult, undefined, 2));

  return finalResult;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const degree = Number(searchParams.get("degree") || 1);

  const result = new Set<String>();

  const uid = searchParams.get("uid");
  
  const friendsOfMine = (await getFansData(uid)).users || [];

  const friendsOfMineSet = new Set<String>(friendsOfMine.map((v) => v.id));

  for (const friend of friendsOfMine) {

    if (friend.name === '新手指南') {
      break;
    }
    
    const fansOfIt = (await getFansData(friend.id)).users || [];
    for (const fans of fansOfIt) {
      if (fans.name === '新手指南') {
        break;
      }
      const fansOfFans = (await getFansData(fans.id)).users || [];
      for (const fansOfFansItem of fansOfFans) {
        if (fansOfFansItem.name === '新手指南') {
          break;
        }
        if (friendsOfMineSet.has(fansOfFansItem.id) && !friendsOfMineSet.has(fans.id) && !result.has(`${fans.name}_${fans.id}`)
         && fans.friends_count<500 && fansOfFansItem.id !== friend.id && fans.id != uid) {
          // result.add(`${fans.name}_${fans.id}`);
          console.log('ADD', `${fans.name} ${fans.id} + (${friend.name}, ${fansOfFansItem.name}`);
          
        }
      }
    }
  }

  return Response.json({ degree, uid, data: Array.from(result) });
}
