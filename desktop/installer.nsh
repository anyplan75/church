!macro customInstall
  CreateShortCut "$SMPROGRAMS\은혜로운 예배 송출.lnk" "$INSTDIR\은혜로운 예배.exe" "--mode=output --display=main"
  CreateShortCut "$SMPROGRAMS\은혜로운 예배 오버레이.lnk" "$INSTDIR\은혜로운 예배.exe" "--mode=output --display=overlay"
  CreateShortCut "$DESKTOP\은혜로운 예배 송출.lnk" "$INSTDIR\은혜로운 예배.exe" "--mode=output --display=main"
!macroend
